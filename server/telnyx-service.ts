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

async function searchAvailableNumbers(
  countryCode: string,
  limit: number = 5
): Promise<AvailableNumberToPurchase[]> {
  if (!apiKey) return [];
  try {
    const params = new URLSearchParams({
      "filter[country_code]": countryCode,
      "filter[features][]": "sms",
      "filter[limit]": String(limit * 2),
    });
    const data = await apiFetch(`/available_phone_numbers?${params}`);
    const results: AvailableNumberToPurchase[] = (data?.data ?? [])
      .slice(0, limit)
      .map((n: any) => {
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
          monthlyFee: n.cost_information?.monthly_cost
            ? parseFloat(n.cost_information.monthly_cost)
            : undefined,
          // Carry Telnyx regulatory_requirements so purchasePhoneNumber can use them
          providerData: {
            regulatory_requirements: n.regulatory_requirements ?? [],
          },
        };
      });
    console.log(`[Telnyx] ${countryCode} — ${results.length} numéro(s) disponible(s)`);
    return results;
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
    const body: any = { phone_number: phoneNumber };
    const messagingProfileId = process.env.TELNYX_MESSAGING_PROFILE_ID;
    if (messagingProfileId) body.messaging_profile_id = messagingProfileId;

    // Injecter le bundle réglementaire pour les numéros France
    if (isFrance && bundleId && rawReqs.length > 0) {
      body.regulatory_requirements = rawReqs.map((req) => ({
        requirement_id: req.requirement_id,
        field_value: bundleId,
      }));
      console.log(`[Telnyx] Achat France avec bundle ${bundleId} (${rawReqs.length} exigence(s))`);
    }

    const data = await apiFetch("/phone_numbers", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const num = data?.data;
    if (!num) return null;
    console.log(`[Telnyx] Numéro ${num.phone_number} acheté ✓ (id: ${num.id})`);
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
    return status === "active";
  } catch {
    return false;
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
