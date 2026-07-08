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
          addressRequired: false,
          monthlyFee: n.cost_information?.monthly_cost
            ? parseFloat(n.cost_information.monthly_cost)
            : undefined,
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
  smsCapable?: boolean
): Promise<PurchasedNumber | null> {
  if (!apiKey) return null;
  if (smsCapable === false) {
    console.warn(`[Telnyx] Achat annulé — ${phoneNumber} n'est pas compatible SMS.`);
    return null;
  }
  try {
    const body: any = { phone_number: phoneNumber };
    const messagingProfileId = process.env.TELNYX_MESSAGING_PROFILE_ID;
    if (messagingProfileId) body.messaging_profile_id = messagingProfileId;

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
    purchaseError.userMessage = `Échec de l'achat auprès de Telnyx : ${err.message}`;
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
