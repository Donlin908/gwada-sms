/**
 * Tests unitaires du webhook Telnyx SMS entrant.
 * Pas de base de données, pas d'Express — logique pure avec dépendances mockées.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseTelnyxMessageReceived,
  processTelnyxInboundSms,
  verifyTelnyxSignature,
  type TelnyxStorageDeps,
} from "../telnyx-webhook-handler";
import crypto from "crypto";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeDeps(overrides: Partial<TelnyxStorageDeps> = {}): TelnyxStorageDeps & {
  createMessage: ReturnType<typeof vi.fn>;
  incrementSmsReceivedCount: ReturnType<typeof vi.fn>;
} {
  return {
    getPhoneNumberByNumber: vi.fn().mockResolvedValue({ id: "phone-123" }),
    getMessageByTwilioSid: vi.fn().mockResolvedValue(undefined),
    createMessage: vi.fn().mockResolvedValue({ id: "msg-1" }),
    incrementSmsReceivedCount: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function validBody(msgId = "telnyx-msg-abc") {
  return {
    data: {
      event_type: "message.received",
      payload: {
        id: msgId,
        to: [{ phone_number: "+33612345678" }],
        from: { phone_number: "+15550001234" },
        text: "Votre code OTP est 4892",
        received_at: "2026-07-27T10:00:00.000Z",
      },
    },
  };
}

// ── parseTelnyxMessageReceived ────────────────────────────────────────────────

describe("parseTelnyxMessageReceived", () => {
  it("retourne les champs corrects pour un payload valide", () => {
    const result = parseTelnyxMessageReceived(validBody());
    expect(result).not.toBeNull();
    expect(result?.toNumber).toBe("+33612345678");
    expect(result?.fromNumber).toBe("+15550001234");
    expect(result?.text).toBe("Votre code OTP est 4892");
    expect(result?.msgId).toBe("telnyx-msg-abc");
    expect(result?.receivedAt).toBeInstanceOf(Date);
  });

  it("retourne null si event_type n'est pas message.received", () => {
    const body = { data: { event_type: "message.sent", payload: {} } };
    expect(parseTelnyxMessageReceived(body)).toBeNull();
  });

  it("retourne null si le champ `to` est absent", () => {
    const body = {
      data: {
        event_type: "message.received",
        payload: { from: { phone_number: "+1555" }, text: "hi" },
      },
    };
    expect(parseTelnyxMessageReceived(body)).toBeNull();
  });

  it("retourne null si le texte est absent", () => {
    const body = {
      data: {
        event_type: "message.received",
        payload: {
          to: [{ phone_number: "+33600000001" }],
          from: { phone_number: "+1555" },
          // text manquant
        },
      },
    };
    expect(parseTelnyxMessageReceived(body)).toBeNull();
  });

  it("retourne null pour un body null/undefined", () => {
    expect(parseTelnyxMessageReceived(null)).toBeNull();
    expect(parseTelnyxMessageReceived(undefined)).toBeNull();
    expect(parseTelnyxMessageReceived({})).toBeNull();
  });

  it("utilise new Date() si received_at est absent", () => {
    const body = {
      data: {
        event_type: "message.received",
        payload: {
          id: "no-ts",
          to: [{ phone_number: "+33600000001" }],
          from: { phone_number: "+1555" },
          text: "test",
          // received_at absent
        },
      },
    };
    const before = Date.now();
    const result = parseTelnyxMessageReceived(body);
    const after = Date.now();
    expect(result).not.toBeNull();
    expect(result!.receivedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(result!.receivedAt.getTime()).toBeLessThanOrEqual(after);
  });
});

// ── processTelnyxInboundSms ───────────────────────────────────────────────────

describe("processTelnyxInboundSms — cas nominal", () => {
  it("crée le message en base et incrémente le compteur", async () => {
    const deps = makeDeps();
    const result = await processTelnyxInboundSms(
      {
        toNumber: "+33612345678",
        fromNumber: "+15550001234",
        text: "Code : 7731",
        msgId: "msg-new-1",
        receivedAt: new Date("2026-07-27T10:00:00Z"),
      },
      deps
    );

    expect(result.stored).toBe(true);
    if (result.stored) expect(result.phoneNumberId).toBe("phone-123");

    expect(deps.createMessage).toHaveBeenCalledOnce();
    expect(deps.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        phoneNumberId: "phone-123",
        twilioMessageSid: "msg-new-1",
        sender: "+15550001234",
        content: "Code : 7731",
      })
    );
    expect(deps.incrementSmsReceivedCount).toHaveBeenCalledWith("phone-123");
  });

  it("stocke le message même sans msgId (pas de déduplication)", async () => {
    const deps = makeDeps();
    const result = await processTelnyxInboundSms(
      {
        toNumber: "+33612345678",
        fromNumber: "+15550001234",
        text: "Sans ID",
        // msgId absent
        receivedAt: new Date(),
      },
      deps
    );

    expect(result.stored).toBe(true);
    expect(deps.getMessageByTwilioSid).not.toHaveBeenCalled();
    expect(deps.createMessage).toHaveBeenCalledOnce();
    expect(deps.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({ twilioMessageSid: null })
    );
  });
});

describe("processTelnyxInboundSms — numéro inconnu", () => {
  it("retourne stored=false reason=unknown_number si le numéro n'est pas en base", async () => {
    const deps = makeDeps({
      getPhoneNumberByNumber: vi.fn().mockResolvedValue(undefined),
    });
    const result = await processTelnyxInboundSms(
      { toNumber: "+33699999999", fromNumber: "+1555", text: "x", receivedAt: new Date() },
      deps
    );

    expect(result.stored).toBe(false);
    if (!result.stored) expect(result.reason).toBe("unknown_number");
    expect(deps.createMessage).not.toHaveBeenCalled();
    expect(deps.incrementSmsReceivedCount).not.toHaveBeenCalled();
  });
});

describe("processTelnyxInboundSms — déduplication", () => {
  it("ignore un msgId déjà enregistré et ne recrée pas le message", async () => {
    const deps = makeDeps({
      getMessageByTwilioSid: vi.fn().mockResolvedValue({ id: "msg-existing" }),
    });
    const result = await processTelnyxInboundSms(
      {
        toNumber: "+33612345678",
        fromNumber: "+1555",
        text: "dupe",
        msgId: "telnyx-msg-abc",
        receivedAt: new Date(),
      },
      deps
    );

    expect(result.stored).toBe(false);
    if (!result.stored) expect(result.reason).toBe("duplicate");
    expect(deps.createMessage).not.toHaveBeenCalled();
    expect(deps.incrementSmsReceivedCount).not.toHaveBeenCalled();
  });

  it("accepte un message avec un nouveau msgId même si un autre message existe", async () => {
    const deps = makeDeps({
      // premier msgId inconnu → undefined, donc on procède
      getMessageByTwilioSid: vi.fn().mockResolvedValue(undefined),
    });
    const result = await processTelnyxInboundSms(
      {
        toNumber: "+33612345678",
        fromNumber: "+1555",
        text: "nouveau",
        msgId: "telnyx-msg-new",
        receivedAt: new Date(),
      },
      deps
    );
    expect(result.stored).toBe(true);
    expect(deps.createMessage).toHaveBeenCalledOnce();
  });
});

// ── verifyTelnyxSignature ─────────────────────────────────────────────────────

describe("verifyTelnyxSignature", () => {
  // Génère une paire de clés Ed25519 pour les tests
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  const publicKeyDerB64 = publicKey.export({ type: "spki", format: "der" }).toString("base64");

  function sign(payload: string, timestamp: string): string {
    const message = Buffer.from(`${timestamp}|${payload}`);
    return crypto.sign(null, message, privateKey).toString("base64");
  }

  it("retourne true pour une signature valide", () => {
    const ts = "1722067200";
    const payload = '{"data":{"event_type":"message.received"}}';
    const sig = sign(payload, ts);
    expect(verifyTelnyxSignature(payload, ts, sig, publicKeyDerB64)).toBe(true);
  });

  it("retourne false si la signature est invalide", () => {
    const ts = "1722067200";
    const payload = '{"data":{"event_type":"message.received"}}';
    const badSig = Buffer.alloc(64).toString("base64"); // 64 zéros
    expect(verifyTelnyxSignature(payload, ts, badSig, publicKeyDerB64)).toBe(false);
  });

  it("retourne false si le payload a été modifié", () => {
    const ts = "1722067200";
    const payload = '{"data":{"event_type":"message.received"}}';
    const sig = sign(payload, ts);
    const tamperedPayload = '{"data":{"event_type":"message.received","injected":true}}';
    expect(verifyTelnyxSignature(tamperedPayload, ts, sig, publicKeyDerB64)).toBe(false);
  });

  it("retourne false si le timestamp diffère de celui signé", () => {
    const ts = "1722067200";
    const payload = '{"data":{"event_type":"message.received"}}';
    const sig = sign(payload, ts);
    expect(verifyTelnyxSignature(payload, "9999999999", sig, publicKeyDerB64)).toBe(false);
  });

  it("retourne false pour une clé publique invalide (ne plante pas)", () => {
    expect(
      verifyTelnyxSignature("payload", "ts", "sig", "notavalidkey==")
    ).toBe(false);
  });
});
