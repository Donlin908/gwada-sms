import type { SmsProvider, AvailableNumberToPurchase, PurchasedNumber, ProviderPhoneNumber } from "./sms-provider";
import { registerProvider } from "./sms-provider";

const TELNYX_API = "https://api.telnyx.com/v2";
const apiKey = process.env.TELNYX_API_KEY;

if (!apiKey) {
  console.warn("[Telnyx] TELNYX_API_KEY non configurée — mode inactif.");
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(`${TELNYX_API}${path}`, {
    ...options,
    headers: { ...headers(), ...(options.headers as Record<string, string> || {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`[Telnyx] ${options.method || "GET"} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function listTelnyxNumbers(): Promise<ProviderPhoneNumber[]> {
  if (!apiKey) return [];
  try {
    const data = await apiFetch("/phone_numbers?page[size]=200");
    return (data?.data ?? []).map((n: any) => ({
      sid: n.id,
      phoneNumber: n.phone_number,
      smsCapable: Array.isArray(n.features)
        ? n.features.some((f: any) => f.name === "sms" || f === "sms")
        : true,
    }));
  } catch (err: any) {
    console.error("[Telnyx] listNumbers:", err.message);
    return [];
  }
}

function mapTelnyxNumber(n: any, countryCode: string, numberType?: "mobile" | "local"): AvailableNumberToPurchase {
  const features: string[] = (n.features ?? []).map((f: any) =>
    typeof f === "string" ? f : f.name
  );
  return {
    phoneNumber: n.phone_number,
    friendlyName: n.phone_number,
    locality: n.region_information?.find((r: any) => r.region_type === "city")?.region_name ?? "",
    region: n.region_information?.find((r: any) => r.region_type === "state")?.region_name ?? "",
    isoCountry: countryCode,
    smsCapable: features.includes("sms"),
    mmsCapable: features.includes("mms"),
    voiceCapable: features.includes("voice"),
    addressRequired: (n.regulatory_requirements ?? []).length > 0,
    numberType: numberType || "unknown",
    monthlyFee: n.cost_information?.monthly_cost
      ? parseFloat(n.cost_information.monthly_cost)
      : undefined,
    providerData: {
      regulatory_requirements: n.regulatory_requirements ?? [],
    },
  };
}

interface TelnyxSearchOptions {
  numberType: "local" | "mobile" | "toll_free";
  /** Quickship = numéros disponibles immédiatement sans délai de provisioning */
  quickship?: boolean;
}

async function fetchTelnyxNumbers(
  countryCode: string,
  fetchLimit: number,
  opts: TelnyxSearchOptions
): Promise<any[]> {
  const params = new URLSearchParams({
    "filter[country_code]": countryCode,
    "filter[limit]": String(fetchLimit),
    "filter[number_type]": opts.numberType,
    // Réservables = achetables programmatiquement ; exclure les numéros déjà retenus
    "filter[reservable]": "true",
    "filter[exclude_held_numbers]": "true",
  });
  // Telnyx : paramètres multi-valeurs avec append() (pas spread objet)
  params.append("filter[features][]", "sms");
  if (opts.quickship) params.append("filter[quickship]", "true");
  const data = await apiFetch(`/available_phone_numbers?${params}`);
  return data?.data ?? [];
}

async function searchAvailableNumbers(
  countryCode: string,
  limit: number = 5
): Promise<AvailableNumberToPurchase[]> {
  if (!apiKey) return [];

  // Ce service est en réception uniquement (OTP/SMS) — MMS jamais requis.
  const isFrance = countryCode === "FR";
  const fetchLimit = limit * 4;

  try {
    let rawNumbers: any[] = [];

    if (isFrance) {
      // France : mobile en priorité (+336/+337), fallback local (+33939)
      try {
        rawNumbers = await fetchTelnyxNumbers(countryCode, fetchLimit, { numberType: "mobile" });
        if (rawNumbers.length > 0) {
          console.log(`[Telnyx] FR Mobile — ${rawNumbers.length} candidat(s) bruts reçus`);
          rawNumbers = rawNumbers.map(n => ({ ...n, _numberType: "mobile" }));
        } else {
          throw new Error("Aucun numéro mobile disponible");
        }
      } catch {
        console.log("[Telnyx] FR Mobile non disponible, fallback sur Local");
        rawNumbers = await fetchTelnyxNumbers(countryCode, fetchLimit, { numberType: "local" });
        rawNumbers = rawNumbers.map(n => ({ ...n, _numberType: "local" }));
        console.log(`[Telnyx] FR Local — ${rawNumbers.length} candidat(s) bruts reçus`);
      }
    } else if (countryCode === "US" || countryCode === "CA") {
      // US / CA : STRICTEMENT MOBILE (rejeter LOCAL qui cause rejet Klarna +18207775864, +19802840149)
      // Même logique que Twilio pour cohérence entre providers
      try {
        // Étape 1 : Chercher MOBILE avec quickship
        rawNumbers = await fetchTelnyxNumbers(countryCode, fetchLimit, {
          numberType: "mobile",
          quickship: true,
        });
        if (rawNumbers.length > 0) {
          console.log(`[Telnyx] ${countryCode} Mobile — ${rawNumbers.length} candidat(s) bruts reçus`);
          rawNumbers = rawNumbers.map(n => ({ ...n, _numberType: "mobile" }));
        } else {
          throw new Error("Aucun numéro mobile quickship disponible");
        }
      } catch (err1: any) {
        console.warn(`[Telnyx] ${countryCode} Mobile quickship non disponible, retry sans quickship`);
        try {
          // Étape 2 : Retry MOBILE sans quickship (toujours PAS de LOCAL fallback!)
          rawNumbers = await fetchTelnyxNumbers(countryCode, fetchLimit, {
            numberType: "mobile",
          });
          if (rawNumbers.length > 0) {
            console.log(`[Telnyx] ${countryCode} Mobile (sans quickship) — ${rawNumbers.length} candidat(s) bruts reçus`);
            rawNumbers = rawNumbers.map(n => ({ ...n, _numberType: "mobile" }));
          } else {
            throw new Error("Aucun numéro mobile disponible");
          }
        } catch (err2: any) {
          // ❌ Pas de MOBILE disponible du tout → rejeter complètement (PAS de LOCAL fallback!)
          console.error(`[Telnyx] ⛔ ${countryCode} — AUCUN NUMÉRO MOBILE DISPONIBLE. Rejeter local pour éviter rejet Klarna (+18207775864, +19802840149).`);
          rawNumbers = [];
        }
      }
    } else {
      // Autres pays : local uniquement
      rawNumbers = await fetchTelnyxNumbers(countryCode, fetchLimit, { numberType: "local" });
      rawNumbers = rawNumbers.map(n => ({ ...n, _numberType: "local" }));
      console.log(`[Telnyx] ${countryCode} Local — ${rawNumbers.length} candidat(s) bruts reçus`);
    }

    // Post-filtre : SMS obligatoire + rejeter si exigences réglementaires pour US/CA
    // (documents administratifs incompatibles avec un achat automatique)
    const filtered = rawNumbers.filter((n: any) => {
      const features: string[] = (n.features ?? []).map((f: any) =>
        typeof f === "string" ? f : f.name
      );
      const reqs: any[] = n.regulatory_requirements ?? [];

      if (!features.includes("sms")) {
        console.warn(`[Telnyx] ${n.phone_number} rejeté — SMS non confirmé`);
        return false;
      }
      const requiresRegulatoryDocs = reqs.length > 0;
      const isNorthAmerica = countryCode === "US" || countryCode === "CA";
      if (isNorthAmerica && requiresRegulatoryDocs) {
        console.warn(`[Telnyx] ${n.phone_number} rejeté — exigences réglementaires pour ${countryCode}`);
        return false;
      }
      return true;
    });

    console.log(`[Telnyx] ${countryCode} — ${filtered.length}/${rawNumbers.length} candidat(s) retenus après filtre`);

    if (filtered.length === 0) {
      console.warn(`[Telnyx] Aucun numéro valide trouvé pour ${countryCode}`);
      return [];
    }

    return filtered.slice(0, limit).map((n: any) => mapTelnyxNumber(n, countryCode, n._numberType));
  } catch (err: any) {
    console.error("[Telnyx] searchAvailableNumbers:", err.message);
    return [];
  }
}

async function purchasePhoneNumber(
  phoneNumber: string,
  friendlyName?: string,
  smsCapable?: boolean,
  providerData?: Record<string, unknown>
): Promise<PurchasedNumber | null> {
  if (!apiKey) return null;
  if (smsCapable === false) {
    console.warn(`[Telnyx] Achat annulé — ${phoneNumber} n'est pas compatible SMS.`);
    return null;
  }

  const bundleId = process.env.TELNYX_FRANCE_BUNDLE_ID;
  const isFrance = phoneNumber.startsWith("+33");
  const rawReqs = (providerData?.regulatory_requirements as Array<{ requirement_id: string; field_value: string | null }> | undefined) ?? [];

  if (isFrance && rawReqs.length > 0 && !bundleId) {
    const err: any = new Error("Bundle réglementaire Telnyx France requis mais TELNYX_FRANCE_BUNDLE_ID non configuré.");
    err.userMessage = "Pour acheter un numéro France via Telnyx, configurez le secret TELNYX_FRANCE_BUNDLE_ID dans Replit (ID du bundle de conformité créé sur portal.telnyx.com).";
    throw err;
  }

  try {
    // Telnyx V2 API : l'achat se fait via POST /number_orders (et non /phone_numbers)
    // Structure : { phone_numbers: [{ phone_number }], messaging_profile_id?, regulatory_requirements? }
    const phoneEntry: any = { phone_number: phoneNumber };
    if (isFrance && bundleId && rawReqs.length > 0) {
      phoneEntry.regulatory_requirements = rawReqs.map((req) => ({
        requirement_id: req.requirement_id,
        field_value: bundleId,
      }));
      console.log(`[Telnyx] Achat France avec bundle ${bundleId} (${rawReqs.length} exigence(s))`);
    }

    const body: any = { phone_numbers: [phoneEntry] };
    const messagingProfileId = process.env.TELNYX_MESSAGING_PROFILE_ID;
    if (messagingProfileId) body.messaging_profile_id = messagingProfileId;

    const data = await apiFetch("/number_orders", {
      method: "POST",
      body: JSON.stringify(body),
    });

    // Réponse : data.data.phone_numbers[0]
    const order = data?.data;
    const num = order?.phone_numbers?.[0];
    if (!num) return null;
    console.log(`[Telnyx] Numéro ${num.phone_number} commandé ✓ (order id: ${order.id})`);
    return {
      sid: num.id,
      phoneNumber: num.phone_number,
      friendlyName: num.phone_number,
    };
  } catch (err: any) {
    const purchaseError: any = new Error(err.message);
    purchaseError.userMessage = err.userMessage ?? `Échec de l'achat auprès de Telnyx : ${err.message}`;
    throw purchaseError;
  }
}

async function releasePhoneNumber(providerId: string): Promise<boolean> {
  if (!apiKey) return false;
  try {
    await apiFetch(`/phone_numbers/${encodeURIComponent(providerId)}`, { method: "DELETE" });
    return true;
  } catch (err: any) {
    console.error("[Telnyx] releasePhoneNumber:", err.message);
    return false;
  }
}

async function checkNumberActive(providerId: string): Promise<boolean> {
  if (!apiKey) return true;
  try {
    const data = await apiFetch(`/phone_numbers/${encodeURIComponent(providerId)}`);
    const status: string = data?.data?.status ?? "";
    // Si l'API répond mais retourne un statut inconnu, on ne pénalise pas le numéro
    if (!status) return true;
    return status === "active";
  } catch {
    // Erreur réseau / API indisponible — on conserve l'état actuel (pas de faux-négatif)
    return true;
  }
}

// ─── Number Lookup ──────────────────────────────────────────────────────────

export interface NumberLookupResult {
  phoneNumber: string;
  /** Type de ligne : mobile | landline | voip | unknown */
  lineType: string;
  /** Nom de l'opérateur (ex. "T-Mobile USA") */
  carrierName: string;
  /** Prénom / nom si disponible (caller-name lookup) */
  callerName?: string;
  callerType?: string;
}

/**
 * Effectue un lookup Telnyx sur un numéro de téléphone.
 * Retourne les infos de carrier + caller-name.
 * Coût : 1 requête API par appel — ne pas appeler en boucle.
 */
export async function lookupPhoneNumber(phoneNumber: string): Promise<NumberLookupResult | null> {
  if (!apiKey) return null;
  try {
    const encoded = encodeURIComponent(phoneNumber);
    const data = await apiFetch(`/number_lookup/${encoded}?type=carrier&type=caller-name`);
    const d = data?.data;
    if (!d) return null;
    return {
      phoneNumber: d.phone_number ?? phoneNumber,
      lineType: d.carrier?.type ?? "unknown",
      carrierName: d.carrier?.name ?? "unknown",
      callerName: d.caller_name?.caller_name ?? undefined,
      callerType: d.caller_name?.caller_type ?? undefined,
    };
  } catch (err: any) {
    console.error("[Telnyx] lookupPhoneNumber:", err.message);
    return null;
  }
}

export const telnyxProvider: SmsProvider = {
  isConfigured: () => !!apiKey,
  listNumbers: listTelnyxNumbers,
  searchAvailableNumbers,
  purchasePhoneNumber,
  releasePhoneNumber,
  checkNumberActive,
};

registerProvider("telnyx", telnyxProvider);
