import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

if (!accountSid || !authToken) {
  console.warn("Twilio credentials not configured. Using demo mode.");
}

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

export interface TwilioPhoneNumber {
  sid: string;
  phoneNumber: string;
  friendlyName: string;
  capabilities: {
    sms: boolean;
    mms: boolean;
    voice: boolean;
  };
}

export interface TwilioMessage {
  sid: string;
  from: string;
  body: string;
  dateSent: Date;
}

export async function getAvailableTwilioNumbers(countryCode: string): Promise<TwilioPhoneNumber[]> {
  if (!client) {
    console.log("Twilio client not available, returning empty list");
    return [];
  }

  try {
    const numbers = await client.incomingPhoneNumbers.list({
      limit: 50,
    });

    return numbers
      .filter(num => {
        const code = countryCode === "FR" ? "+33" : "+1";
        return num.phoneNumber.startsWith(code) && num.capabilities?.sms;
      })
      .map(num => ({
        sid: num.sid,
        phoneNumber: num.phoneNumber,
        friendlyName: num.friendlyName,
        capabilities: {
          sms: num.capabilities?.sms ?? false,
          mms: num.capabilities?.mms ?? false,
          voice: num.capabilities?.voice ?? false,
        },
      }));
  } catch (error) {
    console.error("Error fetching Twilio numbers:", error);
    return [];
  }
}

export async function checkNumberActiveInTwilio(twilioSid: string): Promise<boolean> {
  if (!client) return true;
  if (twilioSid.startsWith("DEMO")) return true;
  try {
    await client.incomingPhoneNumbers(twilioSid).fetch();
    return true;
  } catch {
    return false;
  }
}

export async function getAllTwilioNumbers(): Promise<TwilioPhoneNumber[]> {
  if (!client) {
    console.log("Twilio client not available, returning empty list");
    return [];
  }

  try {
    const numbers = await client.incomingPhoneNumbers.list({
      limit: 100,
    });

    return numbers
      .filter(num => num.capabilities?.sms)
      .map(num => ({
        sid: num.sid,
        phoneNumber: num.phoneNumber,
        friendlyName: num.friendlyName,
        capabilities: {
          sms: num.capabilities?.sms ?? false,
          mms: num.capabilities?.mms ?? false,
          voice: num.capabilities?.voice ?? false,
        },
      }));
  } catch (error) {
    console.error("Error fetching Twilio numbers:", error);
    return [];
  }
}

export async function validatePhoneNumber(phoneNumberSid: string): Promise<boolean> {
  if (!client) {
    return false;
  }

  try {
    const number = await client.incomingPhoneNumbers(phoneNumberSid).fetch();
    return number.status === "in-use" && (number.capabilities?.sms ?? false);
  } catch (error) {
    console.error("Error validating phone number:", error);
    return false;
  }
}

export async function getMessagesForNumber(phoneNumber: string, since?: Date): Promise<TwilioMessage[]> {
  if (!client) {
    console.log("Twilio client not available, returning empty messages");
    return [];
  }

  try {
    const params: Record<string, any> = {
      to: phoneNumber,
      limit: 100,
    };
    // Filter to messages received since the reservation started — avoids fetching
    // the entire message history for popular numbers and avoids the 50-item cap
    if (since) {
      params.dateSentAfter = since;
    }

    const messages = await client.messages.list(params);

    return messages.map(msg => ({
      sid: msg.sid,
      from: msg.from ?? "Unknown",
      body: msg.body ?? "",
      dateSent: msg.dateSent ?? new Date(),
    }));
  } catch (error) {
    console.error("Error fetching messages:", error);
    return [];
  }
}

export function isConfigured(): boolean {
  return client !== null;
}

export interface AvailableNumberToPurchase {
  phoneNumber: string;
  friendlyName: string;
  locality: string;
  region: string;
  isoCountry: string;
  smsCapable: boolean;
  mmsCapable: boolean;
  voiceCapable: boolean;
  addressRequired: boolean;
  monthlyFee?: number;
}

/**
 * Lit une capacité depuis l'objet capabilities de Twilio.
 * L'API Twilio retourne les clés en majuscules (SMS, MMS, voice) dans availablePhoneNumbers
 * mais en minuscules (sms, mms, voice) dans d'autres contextes.
 * Cette fonction gère les deux cas.
 */
function readCap(caps: any, key: string): boolean {
  if (!caps) return false;
  return (
    caps[key] === true ||
    caps[key.toUpperCase()] === true ||
    caps[key.toLowerCase()] === true
  );
}

export async function searchAvailableNumbers(countryCode: string, limit: number = 5): Promise<AvailableNumberToPurchase[]> {
  if (!client) {
    console.log("Twilio client not available");
    return [];
  }

  try {
    const searchParams: Record<string, any> = {
      smsEnabled: true,
      limit: limit * 4,   // marge supplémentaire car le filtre capabilities est strict
    };

    if (countryCode === "US" || countryCode === "CA") {
      searchParams.mmsEnabled = true;
      searchParams.excludeAllAddressRequired = true;
    }

    let rawNumbers: any[] = [];

    if (countryCode === "FR") {
      try {
        const mobileList = await client.availablePhoneNumbers(countryCode).mobile.list(searchParams);
        if (mobileList.length > 0) {
          console.log(`[Twilio] Recherche France Mobile : ${mobileList.length} numéro(s) trouvé(s)`);
          rawNumbers = mobileList.map((n: any) => ({ ...n, _frType: "mobile" }));
        } else {
          throw new Error("Aucun numéro Mobile disponible");
        }
      } catch (mobileErr: any) {
        console.log(`[Twilio] Mobile FR non disponible (${mobileErr?.status || mobileErr?.message}), fallback sur Local`);
        const localList = await client.availablePhoneNumbers(countryCode).local.list(searchParams);
        rawNumbers = localList.map((n: any) => ({ ...n, _frType: "local" }));
        console.log(`[Twilio] Recherche France Local : ${rawNumbers.length} numéro(s) trouvé(s)`);
      }
    } else {
      rawNumbers = await client.availablePhoneNumbers(countryCode).local.list(searchParams);
    }

    console.log(`[Twilio] ${countryCode} — ${rawNumbers.length} candidat(s) bruts reçus de Twilio`);

    // Filtre strict sur les capabilities en lisant les clés uppercase ET lowercase
    const filtered = rawNumbers.filter((num: any) => {
      const caps = num.capabilities;
      const hasCaps = caps && typeof caps === "object";

      // Lecture SMS : accepté si vrai en minuscule OU majuscule
      const smsOk = hasCaps ? readCap(caps, "sms") : false;
      // MMS requis pour USA et Canada
      const mmsRequired = countryCode === "US" || countryCode === "CA";
      const mmsOk = hasCaps ? readCap(caps, "mms") : false;

      if (!hasCaps) {
        // Pas d'objet capabilities du tout — on log et on rejette par prudence
        console.warn(`[Twilio] ${num.phoneNumber} rejeté — pas de données capabilities.`);
        return false;
      }
      if (!smsOk) {
        console.warn(`[Twilio] ${num.phoneNumber} rejeté — SMS non confirmé (caps: ${JSON.stringify(caps)})`);
        return false;
      }
      if (mmsRequired && !mmsOk) {
        console.warn(`[Twilio] ${num.phoneNumber} rejeté — MMS non confirmé pour ${countryCode} (caps: ${JSON.stringify(caps)})`);
        return false;
      }
      return true;
    });

    console.log(`[Twilio] ${countryCode} — ${filtered.length}/${rawNumbers.length} candidat(s) retenu(s) après filtre capabilities`);

    const mmsSupported = countryCode === "US" || countryCode === "CA";
    const results = filtered.slice(0, limit);

    if (results.length === 0 && rawNumbers.length > 0) {
      // Fallback uniquement si le filtre MMS est trop strict — on garde au moins le SMS
      if (mmsSupported) {
        const smsOnly = rawNumbers.filter((num: any) => {
          const caps = num.capabilities;
          return caps && typeof caps === "object" && readCap(caps, "sms");
        }).slice(0, limit);
        if (smsOnly.length > 0) {
          console.log(`[Twilio] Fallback SMS-uniquement : ${smsOnly.length} numéro(s) pour ${countryCode}`);
          return smsOnly.map((num: any) => mapNumber(num, false));
        }
      }
      console.warn(`[Twilio] Aucun numéro SMS valide trouvé pour ${countryCode} après filtre capabilities.`);
      return [];
    }

    return results.map((num: any) => mapNumber(num, mmsSupported));
  } catch (error) {
    console.error("Error searching available numbers:", error);
    return [];
  }
}

function mapNumber(num: any, mmsCapable: boolean): AvailableNumberToPurchase {
  const caps = num.capabilities || {};
  const addrReq = num.addressRequirements ?? "none";
  // Lecture robuste : clés uppercase (SMS, MMS) ou lowercase (sms, mms) selon le contexte Twilio
  const smsOk = readCap(caps, "sms");
  const mmsOk = mmsCapable && readCap(caps, "mms");
  const voiceOk = readCap(caps, "voice");
  return {
    phoneNumber: num.phoneNumber,
    friendlyName: num.friendlyName,
    locality: num.locality || "",
    region: num.region || "",
    isoCountry: num.isoCountry,
    smsCapable: smsOk,
    mmsCapable: mmsOk,
    voiceCapable: voiceOk,
    addressRequired: addrReq !== "none",
  };
}

export interface PurchasedNumber {
  sid: string;
  phoneNumber: string;
  friendlyName: string;
}

const APPROVED_BUNDLE_STATUSES = ["twilio-approved", "provisionally-approved"];

async function getTwilioAddressSid(): Promise<string | undefined> {
  if (!client) return undefined;
  try {
    const envSid = process.env.TWILIO_ADDRESS_SID;
    if (envSid) {
      try {
        await client.addresses(envSid).fetch();
        return envSid;
      } catch {
        console.warn(`[Twilio] TWILIO_ADDRESS_SID ${envSid} invalide pour ce compte — recherche dynamique.`);
      }
    }
    const addresses = await client.addresses.list({ limit: 10 });
    const french = addresses.find(a => a.isoCountry === "FR") || addresses[0];
    return french?.sid;
  } catch {
    return undefined;
  }
}

export async function checkFranceBundleApproved(): Promise<boolean> {
  if (!client) return false;
  try {
    const bundles = await client.numbers.v2.regulatoryCompliance.bundles.list({ limit: 20 });
    const approved = bundles.find(b => APPROVED_BUNDLE_STATUSES.includes(b.status as string));
    return !!approved;
  } catch {
    return false;
  }
}

async function getApprovedBundleSid(countryCode: string): Promise<string | undefined> {
  if (!client) return undefined;
  try {
    const allBundles = await client.numbers.v2.regulatoryCompliance.bundles.list({ limit: 20 });
    const approved = allBundles.find(b =>
      APPROVED_BUNDLE_STATUSES.includes(b.status as string) &&
      ((b as any).isoCountry === countryCode || !(b as any).isoCountry)
    );
    if (approved) {
      console.log(`[Twilio] Bundle approuvé trouvé pour ${countryCode}: ${approved.sid} (${approved.friendlyName}) — statut: ${approved.status}`);
      return approved.sid;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export async function purchasePhoneNumber(
  phoneNumber: string,
  friendlyName?: string,
  smsCapable?: boolean
): Promise<PurchasedNumber | null> {
  if (!client) {
    console.log("Twilio client not available");
    return null;
  }

  if (smsCapable === false) {
    console.warn(`[Twilio] Achat annulé — ${phoneNumber} n'est pas compatible SMS.`);
    return null;
  }

  try {
    const isFranceNumber = phoneNumber.startsWith("+33");
    const [addressSid, bundleSid] = await Promise.all([
      getTwilioAddressSid(),
      isFranceNumber ? getApprovedBundleSid("FR") : Promise.resolve(undefined),
    ]);

    // Numéros mobiles France : +336xx ou +337xx — nécessitent un bundle ARCEP Mobile
    // Numéros locaux France : +3393xxx — pas de bundle requis (type Local)
    const isFranceMobile = phoneNumber.startsWith("+336") || phoneNumber.startsWith("+337");

    const params: any = {
      phoneNumber,
      friendlyName: friendlyName || `GwadaSMS-${new Date().toISOString().split('T')[0]}`,
    };
    if (addressSid) params.addressSid = addressSid;
    if (bundleSid && isFranceMobile) {
      params.bundleSid = bundleSid;
      console.log(`[Twilio] Achat France Mobile avec bundle ${bundleSid}`);
    } else if (isFranceMobile && !bundleSid) {
      console.warn(`[Twilio] Aucun bundle ARCEP Mobile approuvé pour FR Mobile — l'achat risque d'échouer.`);
    } else if (isFranceNumber && !isFranceMobile) {
      console.log(`[Twilio] Achat France Local (+339) — pas de bundle requis`);
    }

    const purchased = await client.incomingPhoneNumbers.create(params);

    const smsCapable = purchased.capabilities?.sms ?? false;
    if (!smsCapable) {
      console.warn(
        `[Twilio] Numéro ${purchased.phoneNumber} acheté mais sans capacité SMS — libération immédiate.`
      );
      try {
        await client.incomingPhoneNumbers(purchased.sid).remove();
      } catch (releaseErr) {
        console.error(`[Twilio] Impossible de libérer ${purchased.phoneNumber}:`, releaseErr);
      }
      return null;
    }

    console.log(
      `[Twilio] Numéro ${purchased.phoneNumber} acheté ✓ — SMS: ${smsCapable} | MMS: ${purchased.capabilities?.mms ?? false} | Voice: ${purchased.capabilities?.voice ?? false}`
    );

    return {
      sid: purchased.sid,
      phoneNumber: purchased.phoneNumber,
      friendlyName: purchased.friendlyName,
    };
  } catch (error: any) {
    const code = error?.code;
    const isFranceLocal = phoneNumber.startsWith("+339");
    let userMessage: string;
    if (code === 21649) {
      if (isFranceLocal) {
        userMessage =
          `Le numéro ${phoneNumber} est un numéro France de type "Local". ` +
          `Votre bundle ARCEP approuvé est de type "Mobile" et ne peut pas servir à acheter un numéro Local. ` +
          `Twilio n'a actuellement aucun numéro Mobile France en stock. ` +
          `Solution : créez un bundle ARCEP de type "Local" sur console.twilio.com/us1/regulatory-compliance/bundles, ou attendez le retour en stock des numéros Mobile.`;
      } else {
        userMessage =
          `Le numéro ${phoneNumber} nécessite un dossier de conformité réglementaire (bundle ARCEP France) approuvé du même type que le numéro. ` +
          `Créez-le sur console.twilio.com/us1/regulatory-compliance/bundles`;
      }
      console.warn(`[Twilio] ${userMessage}`);
    } else if (code === 21404) {
      userMessage = `Le numéro ${phoneNumber} est indisponible (limite de compte trial ou numéro déjà attribué). Mettez à jour votre compte Twilio.`;
      console.warn(`[Twilio] ${userMessage}`);
    } else {
      console.error("Error purchasing phone number:", error);
      userMessage = error?.message
        ? `Échec de l'achat auprès de Twilio : ${error.message}`
        : "Échec de l'achat du numéro auprès de Twilio.";
    }
    const purchaseError: any = new Error(userMessage);
    purchaseError.userMessage = userMessage;
    purchaseError.code = code;
    purchaseError.isFranceLocal = isFranceLocal;
    throw purchaseError;
  }
}

export async function getTwilioDiagnostics(): Promise<{ bundles: any[]; addresses: any[] }> {
  if (!client) return { bundles: [], addresses: [] };
  try {
    const [bundles, addresses] = await Promise.all([
      client.numbers.v2.regulatoryCompliance.bundles.list({ limit: 20 }),
      client.addresses.list({ limit: 20 }),
    ]);
    return {
      bundles: bundles.map(b => ({ sid: b.sid, name: (b as any).friendlyName, status: b.status, country: (b as any).isoCountry })),
      addresses: addresses.map(a => ({ sid: a.sid, name: a.friendlyName, country: a.isoCountry, city: a.city })),
    };
  } catch (e: any) {
    console.error("[Twilio] Diagnostic error:", e.message);
    return { bundles: [], addresses: [] };
  }
}

export async function releasePhoneNumber(phoneNumberSid: string): Promise<boolean> {
  if (!client) {
    return false;
  }

  try {
    await client.incomingPhoneNumbers(phoneNumberSid).remove();
    return true;
  } catch (error) {
    console.error("Error releasing phone number:", error);
    return false;
  }
}

import type { SmsProvider, ProviderPhoneNumber } from "./sms-provider";
import { registerProvider } from "./sms-provider";

export const twilioProvider: SmsProvider = {
  isConfigured,
  async listNumbers(): Promise<ProviderPhoneNumber[]> {
    const all = await getAllTwilioNumbers();
    return all.map(n => ({
      sid: n.sid,
      phoneNumber: n.phoneNumber,
      smsCapable: n.capabilities.sms,
    }));
  },
  searchAvailableNumbers,
  purchasePhoneNumber,
  releasePhoneNumber,
  async checkNumberActive(providerId: string): Promise<boolean> {
    return checkNumberActiveInTwilio(providerId);
  },
};

registerProvider("twilio", twilioProvider);
