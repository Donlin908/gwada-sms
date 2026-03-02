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
}

export async function searchAvailableNumbers(countryCode: "FR" | "US", limit: number = 5): Promise<AvailableNumberToPurchase[]> {
  if (!client) {
    console.log("Twilio client not available");
    return [];
  }

  try {
    // Twilio ne propose que "local" pour FR et "local"/"toll_free" pour US.
    // Le champ capabilities.sms est undefined dans la recherche (comportement API Twilio connu),
    // mais le paramètre smsEnabled:true garantit la compatibilité SMS à l'achat.
    const numbers = await client.availablePhoneNumbers(countryCode).local
      .list({ smsEnabled: true, limit: limit * 2 });

    return numbers.slice(0, limit).map((num: any) => ({
      phoneNumber: num.phoneNumber,
      friendlyName: num.friendlyName,
      locality: num.locality || "",
      region: num.region || "",
      isoCountry: num.isoCountry,
      smsCapable: true, // garanti par smsEnabled:true dans la requête API Twilio
    }));
  } catch (error) {
    console.error("Error searching available numbers:", error);
    return [];
  }
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
    const addressSid = process.env.TWILIO_ADDRESS_SID || await getTwilioAddressSid();
    const params: any = {
      phoneNumber,
      friendlyName: friendlyName || `GwadaSMS-${new Date().toISOString().split('T')[0]}`,
    };
    if (addressSid) {
      params.addressSid = addressSid;
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
