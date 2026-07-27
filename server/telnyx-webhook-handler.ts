/**
 * Logique métier du webhook Telnyx — extraite pour être testable
 * sans Express ni base de données réelle.
 */
import crypto from "crypto";

// ── Types ────────────────────────────────────────────────────────────────────

export interface TelnyxInboundSms {
  toNumber: string;
  fromNumber: string;
  text: string;
  msgId?: string;
  receivedAt: Date;
}

/** Sous-ensemble minimal de IStorage utilisé par ce handler */
export interface TelnyxStorageDeps {
  getPhoneNumberByNumber(number: string): Promise<{ id: string } | undefined>;
  getMessageByTwilioSid(sid: string): Promise<{ id: string } | undefined>;
  createMessage(data: {
    phoneNumberId: string;
    twilioMessageSid: string | null;
    sender: string;
    content: string;
    receivedAt: Date;
  }): Promise<{ id: string }>;
  incrementSmsReceivedCount(phoneNumberId: string): Promise<void>;
}

export type TelnyxProcessResult =
  | { stored: true; phoneNumberId: string }
  | { stored: false; reason: "missing_fields" | "unknown_number" | "duplicate" };

// ── Parsing ───────────────────────────────────────────────────────────────────

/**
 * Extrait les champs utiles depuis le payload brut d'un event Telnyx.
 * Retourne null si le payload n'est pas un `message.received` valide.
 */
export function parseTelnyxMessageReceived(body: unknown): TelnyxInboundSms | null {
  const event = (body as any)?.data;
  if (!event || event.event_type !== "message.received") return null;

  const payload = event.payload;
  const toNumber: string | undefined = payload?.to?.[0]?.phone_number;
  const fromNumber: string | undefined = payload?.from?.phone_number;
  const text: string | undefined = payload?.text;
  const msgId: string | undefined = payload?.id;
  const receivedAt = payload?.received_at ? new Date(payload.received_at) : new Date();

  if (!toNumber || !fromNumber || !text) return null;

  return { toNumber, fromNumber, text, msgId, receivedAt };
}

// ── Processing ────────────────────────────────────────────────────────────────

/**
 * Enregistre un SMS entrant Telnyx en base.
 * Gère la déduplication sur msgId.
 */
export async function processTelnyxInboundSms(
  sms: TelnyxInboundSms,
  deps: TelnyxStorageDeps
): Promise<TelnyxProcessResult> {
  const phoneNumber = await deps.getPhoneNumberByNumber(sms.toNumber);
  if (!phoneNumber) {
    return { stored: false, reason: "unknown_number" };
  }

  // Déduplication — même msgId déjà enregistré
  if (sms.msgId) {
    const existing = await deps.getMessageByTwilioSid(sms.msgId);
    if (existing) return { stored: false, reason: "duplicate" };
  }

  await deps.createMessage({
    phoneNumberId: phoneNumber.id,
    twilioMessageSid: sms.msgId ?? null,
    sender: sms.fromNumber,
    content: sms.text,
    receivedAt: sms.receivedAt,
  });

  await deps.incrementSmsReceivedCount(phoneNumber.id);

  return { stored: true, phoneNumberId: phoneNumber.id };
}

// ── Signature ─────────────────────────────────────────────────────────────────

/**
 * Vérifie la signature Ed25519 d'un webhook Telnyx.
 * Telnyx signe : timestamp + "|" + rawPayload
 * @param rawPayload  Corps brut (Buffer.toString() ou JSON.stringify)
 * @param timestamp   Header telnyx-timestamp
 * @param signature   Header telnyx-signature-ed25519 (base64)
 * @param publicKeyB64 TELNYX_PUBLIC_KEY (DER SPKI, base64)
 */
export function verifyTelnyxSignature(
  rawPayload: string,
  timestamp: string,
  signature: string,
  publicKeyB64: string
): boolean {
  try {
    const message = Buffer.from(`${timestamp}|${rawPayload}`);
    const pubKey = crypto.createPublicKey({
      key: Buffer.from(publicKeyB64, "base64"),
      format: "der",
      type: "spki",
    });
    return crypto.verify(null, message, pubKey, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}
