/**
 * Schémas Zod pour validation des webhooks (Telnyx, Stripe, etc.)
 * Appliqués au runtime pour rejeter les payloads malformés
 */

import { z } from "zod";

/**
 * Schema Telnyx — message.received webhook
 * Validation stricte : phone_number format, texte longueur, timestamp RFC3339
 */
export const telnyxMessageReceivedSchema = z.object({
  data: z.object({
    event_type: z.literal("message.received"),
    payload: z.object({
      id: z.string().uuid("Message ID must be valid UUID"),
      to: z.array(
        z.object({
          phone_number: z.string().regex(/^\+\d{1,15}$/, "Invalid phone number format"),
        })
      ).min(1, "At least one recipient required"),
      from: z.object({
        phone_number: z.string().regex(/^\+\d{1,15}$/, "Invalid phone number format"),
      }),
      text: z.string().min(1, "Message text cannot be empty").max(160, "Message exceeds SMS length"),
      received_at: z.string().datetime("Invalid timestamp format"),
    }),
  }),
});

export type TelnyxMessageReceivedEvent = z.infer<typeof telnyxMessageReceivedSchema>;

/**
 * Schema Stripe — payment_intent.succeeded webhook
 * Validation : montant positif, devise valide, eventId unique
 */
export const stripePaymentIntentSchema = z.object({
  id: z.string().startsWith("evt_", "Event ID must start with evt_"),
  type: z.literal("payment_intent.succeeded"),
  data: z.object({
    object: z.object({
      id: z.string().startsWith("pi_", "Payment Intent ID must start with pi_"),
      amount: z.number().int().min(100, "Amount must be >= 100 cents (1.00€)").max(999999, "Amount must be <= 9999.99€"),
      currency: z.enum(["eur", "usd"], { errorMap: () => ({ message: "Only EUR and USD supported" }) }),
      status: z.literal("succeeded"),
      client_secret: z.string().min(1),
    }),
  }),
});

export type StripePaymentIntentEvent = z.infer<typeof stripePaymentIntentSchema>;

/**
 * Parse et valide un payload Telnyx webhook
 * @returns Payload validé ou erreur
 */
export function validateTelnyxWebhook(payload: unknown): TelnyxMessageReceivedEvent {
  try {
    return telnyxMessageReceivedSchema.parse(payload);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const messages = err.errors.map(e => `${e.path.join(".")}: ${e.message}`).join("; ");
      throw new Error(`[Telnyx Webhook] Validation failed: ${messages}`);
    }
    throw err;
  }
}

/**
 * Parse et valide un payload Stripe webhook
 * @returns Payload validé ou erreur
 */
export function validateStripeWebhook(payload: unknown): StripePaymentIntentEvent {
  try {
    return stripePaymentIntentSchema.parse(payload);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const messages = err.errors.map(e => `${e.path.join(".")}: ${e.message}`).join("; ");
      throw new Error(`[Stripe Webhook] Validation failed: ${messages}`);
    }
    throw err;
  }
}
