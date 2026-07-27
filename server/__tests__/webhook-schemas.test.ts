import { describe, it, expect } from "vitest";
import { validateTelnyxWebhook, validateStripeWebhook } from "../webhook-schemas";
import { z } from "zod";

describe("Webhook Schema Validation — Telnyx", () => {
  const validTelnyxPayload = {
    data: {
      event_type: "message.received",
      payload: {
        id: "12345678-1234-1234-1234-123456789abc",
        to: [
          {
            phone_number: "+33612345678",
          },
        ],
        from: {
          phone_number: "+33687654321",
        },
        text: "Hello, this is a test message",
        received_at: "2026-07-25T10:30:00Z",
      },
    },
  };

  describe("validateTelnyxWebhook", () => {
    it("accepte un payload Telnyx valide", () => {
      expect(() => {
        validateTelnyxWebhook(validTelnyxPayload);
      }).not.toThrow();
    });

    it("rejette payload sans event_type", () => {
      const invalid = {
        data: {
          payload: { ...validTelnyxPayload.data.payload },
        },
      };

      expect(() => {
        validateTelnyxWebhook(invalid);
      }).toThrow();
    });

    it("rejette event_type incorrect", () => {
      const invalid = {
        data: {
          event_type: "message.sent", // ← Mauvais type
          payload: { ...validTelnyxPayload.data.payload },
        },
      };

      expect(() => {
        validateTelnyxWebhook(invalid);
      }).toThrow("Received input does not match the expected schema");
    });

    it("rejette phone_number invalide (sans +)", () => {
      const invalid = {
        data: {
          event_type: "message.received",
          payload: {
            ...validTelnyxPayload.data.payload,
            from: {
              phone_number: "33687654321", // ← Pas de + préfixe
            },
          },
        },
      };

      expect(() => {
        validateTelnyxWebhook(invalid);
      }).toThrow();
    });

    it("rejette phone_number trop long (>15 chiffres)", () => {
      const invalid = {
        data: {
          event_type: "message.received",
          payload: {
            ...validTelnyxPayload.data.payload,
            from: {
              phone_number: "+336876543211111", // 16 chiffres
            },
          },
        },
      };

      expect(() => {
        validateTelnyxWebhook(invalid);
      }).toThrow();
    });

    it("rejette text vide", () => {
      const invalid = {
        data: {
          event_type: "message.received",
          payload: {
            ...validTelnyxPayload.data.payload,
            text: "", // ← Vide
          },
        },
      };

      expect(() => {
        validateTelnyxWebhook(invalid);
      }).toThrow();
    });

    it("rejette text > 160 caractères (SMS limité)", () => {
      const invalid = {
        data: {
          event_type: "message.received",
          payload: {
            ...validTelnyxPayload.data.payload,
            text: "a".repeat(161), // 161 caractères
          },
        },
      };

      expect(() => {
        validateTelnyxWebhook(invalid);
      }).toThrow();
    });

    it("rejette timestamp invalide", () => {
      const invalid = {
        data: {
          event_type: "message.received",
          payload: {
            ...validTelnyxPayload.data.payload,
            received_at: "not-a-date", // Pas un ISO datetime
          },
        },
      };

      expect(() => {
        validateTelnyxWebhook(invalid);
      }).toThrow();
    });

    it("rejette id non-UUID", () => {
      const invalid = {
        data: {
          event_type: "message.received",
          payload: {
            ...validTelnyxPayload.data.payload,
            id: "not-a-uuid", // Pas un UUID
          },
        },
      };

      expect(() => {
        validateTelnyxWebhook(invalid);
      }).toThrow();
    });

    it("rejette tableau 'to' vide", () => {
      const invalid = {
        data: {
          event_type: "message.received",
          payload: {
            ...validTelnyxPayload.data.payload,
            to: [], // Vide
          },
        },
      };

      expect(() => {
        validateTelnyxWebhook(invalid);
      }).toThrow();
    });
  });

  describe("Webhook Schema Validation — Stripe", () => {
    const validStripePayload = {
      id: "evt_1234567890abcdefg",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_1234567890abcdefg",
          amount: 9999, // 99.99€
          currency: "eur",
          status: "succeeded",
          client_secret: "pi_1234567890abcdefg_secret_test",
        },
      },
    };

    it("accepte un payload Stripe valide", () => {
      expect(() => {
        validateStripeWebhook(validStripePayload);
      }).not.toThrow();
    });

    it("rejette montant négatif", () => {
      const invalid = {
        ...validStripePayload,
        data: {
          object: {
            ...validStripePayload.data.object,
            amount: -9999,
          },
        },
      };

      expect(() => {
        validateStripeWebhook(invalid);
      }).toThrow();
    });

    it("rejette montant < 100 cents (< 1.00€)", () => {
      const invalid = {
        ...validStripePayload,
        data: {
          object: {
            ...validStripePayload.data.object,
            amount: 50, // < 100
          },
        },
      };

      expect(() => {
        validateStripeWebhook(invalid);
      }).toThrow();
    });

    it("rejette montant > 999999 cents (> 9999.99€)", () => {
      const invalid = {
        ...validStripePayload,
        data: {
          object: {
            ...validStripePayload.data.object,
            amount: 1000000, // > 999999
          },
        },
      };

      expect(() => {
        validateStripeWebhook(invalid);
      }).toThrow();
    });

    it("rejette devise invalide", () => {
      const invalid = {
        ...validStripePayload,
        data: {
          object: {
            ...validStripePayload.data.object,
            currency: "gbp", // Pas supporté
          },
        },
      };

      expect(() => {
        validateStripeWebhook(invalid);
      }).toThrow();
    });

    it("accepte devise USD", () => {
      const valid = {
        ...validStripePayload,
        data: {
          object: {
            ...validStripePayload.data.object,
            currency: "usd",
          },
        },
      };

      expect(() => {
        validateStripeWebhook(valid);
      }).not.toThrow();
    });

    it("rejette type d'événement incorrecte", () => {
      const invalid = {
        ...validStripePayload,
        type: "charge.refunded", // Pas payment_intent.succeeded
      };

      expect(() => {
        validateStripeWebhook(invalid);
      }).toThrow();
    });

    it("rejette event ID invalide", () => {
      const invalid = {
        ...validStripePayload,
        id: "invalid_id_12345", // Pas evt_*
      };

      expect(() => {
        validateStripeWebhook(invalid);
      }).toThrow();
    });

    it("rejette payment intent ID invalide", () => {
      const invalid = {
        ...validStripePayload,
        data: {
          object: {
            ...validStripePayload.data.object,
            id: "invalid_pi_12345", // Pas pi_*
          },
        },
      };

      expect(() => {
        validateStripeWebhook(invalid);
      }).toThrow();
    });

    it("rejette status !== succeeded", () => {
      const invalid = {
        ...validStripePayload,
        data: {
          object: {
            ...validStripePayload.data.object,
            status: "requires_payment_method",
          },
        },
      };

      expect(() => {
        validateStripeWebhook(invalid);
      }).toThrow();
    });
  });
});
