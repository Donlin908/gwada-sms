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

export async function getMessagesForNumber(phoneNumber: string): Promise<TwilioMessage[]> {
  if (!client) {
    console.log("Twilio client not available, returning empty messages");
    return [];
  }

  try {
    const messages = await client.messages.list({
      to: phoneNumber,
      limit: 50,
    });

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

export async function searchAvailableNumbers(countryCode: "FR" | "US", limit: number = 5): Promise<AvailableNumberToPurchase[]> {
  if (!client) {
    console.log("Twilio client not available");
    return [];
  }

  try {
    // Filtres basés sur les colonnes visibles dans la console Twilio :
    // Capabilities (Voice/SMS/MMS/Fax) + Address Requirement + Type
    const searchParams: Record<string, any> = {
      smsEnabled: true,   // Colonne SMS — obligatoire pour les deux pays
      limit: limit * 3,   // On récupère plus pour compenser les filtres stricts
    };

    if (countryCode === "US") {
      // USA : MMS supporté + exclure les numéros qui nécessitent une adresse (Address Requirement: None)
      searchParams.mmsEnabled = true;
      searchParams.excludeAllAddressRequired = true;
    }
    // France : les numéros locaux FR ne supportent PAS MMS (0 résultat avec mmsEnabled:true)
    // Tous les numéros FR exigent une adresse locale (AddrReq: local) — fournie via TWILIO_ADDRESS_SID + bundle ARCEP

    const rawNumbers = await client.availablePhoneNumbers(countryCode).local
      .list(searchParams);

    // Filtre supplémentaire : on rejette les numéros fax-only ou sans MMS confirmé
    // Note : capabilities peut être undefined dans la recherche (comportement Twilio connu)
    // On se fie à mmsEnabled:true de la requête comme garantie principale
    const filtered = rawNumbers.filter((num: any) => {
      // Si capabilities est renseigné, vérifier SMS + MMS
      if (num.capabilities && typeof num.capabilities.sms !== "undefined") {
        return num.capabilities.sms === true && num.capabilities.mms === true;
      }
      // Sinon, on fait confiance aux paramètres de la requête API
      return true;
    });

    const results = filtered.slice(0, limit);

    if (results.length === 0 && rawNumbers.length > 0) {
      // Fallback : si MMS strict élimine tout, prendre SMS seul
      console.log(`[Twilio] Aucun numéro SMS+MMS disponible pour ${countryCode}, fallback SMS uniquement`);
      return rawNumbers.slice(0, limit).map((num: any) => mapNumber(num, false));
    }

    const mmsSupported = countryCode === "US";
    return results.map((num: any) => mapNumber(num, mmsSupported));
  } catch (error) {
    console.error("Error searching available numbers:", error);
    return [];
  }
}

function mapNumber(num: any, mmsCapable: boolean): AvailableNumberToPurchase {
  const caps = num.capabilities || {};
  // addressRequirements : "none" | "any" | "local" | "foreign"
  const addrReq = num.addressRequirements ?? "none";
  return {
    phoneNumber: num.phoneNumber,
    friendlyName: num.friendlyName,
    locality: num.locality || "",
    region: num.region || "",
    isoCountry: num.isoCountry,
    smsCapable: true,                              // garanti par smsEnabled:true
    mmsCapable,                                    // garanti par mmsEnabled:true ou fallback
    voiceCapable: caps.voice !== false,            // Voice presque toujours true
    addressRequired: addrReq !== "none",           // Colonne "Address Requirement"
  };
}

export interface PurchasedNumber {
  sid: string;
  phoneNumber: string;
  friendlyName: string;
}

async function getTwilioAddressSid(): Promise<string | undefined> {
  if (!client) return undefined;
  try {
    const addresses = await client.addresses.list({ limit: 1 });
    return addresses[0]?.sid;
  } catch {
    return undefined;
  }
}

export async function checkFranceBundleApproved(): Promise<boolean> {
  if (!client) return false;
  try {
    const bundles = await client.numbers.v2.regulatoryCompliance.bundles.list({ limit: 20 });
    const approved = bundles.find(b => b.status === "twilio-approved");
    return !!approved;
  } catch {
    return false;
  }
}

async function getApprovedBundleSid(countryCode: string): Promise<string | undefined> {
  if (!client) return undefined;
  try {
    const bundles = await client.numbers.v2.regulatoryCompliance.bundles.list({
      status: "twilio-approved",
      isoCountry: countryCode,
      limit: 10,
    });
    if (bundles.length > 0) {
      console.log(`[Twilio] Bundle approuvé trouvé pour ${countryCode}: ${bundles[0].sid} (${bundles[0].friendlyName})`);
      return bundles[0].sid;
    }
    // Fallback : chercher aussi les bundles "pending-review" au cas où l'API filtre différemment
    const allBundles = await client.numbers.v2.regulatoryCompliance.bundles.list({ limit: 20 });
    const approved = allBundles.find(b =>
      b.status === "twilio-approved" &&
      (b.isoCountry === countryCode || b.isoCountry === undefined)
    );
    return approved?.sid;
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
      process.env.TWILIO_ADDRESS_SID ? Promise.resolve(process.env.TWILIO_ADDRESS_SID) : getTwilioAddressSid(),
      isFranceNumber ? getApprovedBundleSid("FR") : Promise.resolve(undefined),
    ]);

    const params: any = {
      phoneNumber,
      friendlyName: friendlyName || `GwadaSMS-${new Date().toISOString().split('T')[0]}`,
    };
    if (addressSid) params.addressSid = addressSid;
    if (bundleSid) {
      params.bundleSid = bundleSid;
      console.log(`[Twilio] Achat France avec bundle ${bundleSid}`);
    } else if (isFranceNumber) {
      console.warn(`[Twilio] Aucun bundle approuvé pour FR — l'achat risque d'échouer (bundle en attente de validation Twilio).`);
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
    if (code === 21649) {
      console.warn(
        `[Twilio] Numéro ${phoneNumber} — dossier de conformité réglementaire requis (bundle ARCEP France). ` +
        `Créez un bundle sur console.twilio.com/us1/regulatory-compliance/bundles`
      );
    } else if (code === 21404) {
      console.warn(`[Twilio] Numéro ${phoneNumber} — limite de compte trial dépassée. Mettez à jour votre compte.`);
    } else {
      console.error("Error purchasing phone number:", error);
    }
    return null;
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
