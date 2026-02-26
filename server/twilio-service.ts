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
}

export async function searchAvailableNumbers(countryCode: "FR" | "US", limit: number = 5): Promise<AvailableNumberToPurchase[]> {
  if (!client) {
    console.log("Twilio client not available");
    return [];
  }

  try {
    const numbers = await client.availablePhoneNumbers(countryCode)
      .local
      .list({ smsEnabled: true, limit });

    return numbers.map(num => ({
      phoneNumber: num.phoneNumber,
      friendlyName: num.friendlyName,
      locality: num.locality || "",
      region: num.region || "",
      isoCountry: num.isoCountry,
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

export async function purchasePhoneNumber(phoneNumber: string, friendlyName?: string): Promise<PurchasedNumber | null> {
  if (!client) {
    console.log("Twilio client not available");
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

    return {
      sid: purchased.sid,
      phoneNumber: purchased.phoneNumber,
      friendlyName: purchased.friendlyName,
    };
  } catch (error) {
    console.error("Error purchasing phone number:", error);
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
