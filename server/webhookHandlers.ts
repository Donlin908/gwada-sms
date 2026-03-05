import { getStripeSync } from './stripeClient';
import { storage } from './storage';
import { db } from './db';
import { users, phoneNumbers, pricingPlans } from '@shared/schema';
import { eq } from 'drizzle-orm';
import * as telegram from './telegram-service';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    try {
      const event = await sync.processWebhook(payload, signature);
      
      console.log(`[Webhook] Event processed: ${event?.type || 'unknown'}`);

      if (event && event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const metadata = session.metadata || {};
        const phoneNumberId = metadata.phoneNumberId;
        const planId = metadata.planId;
        const userSessionId = metadata.userSessionId;

        if (!phoneNumberId || !planId) {
          console.error("[Webhook] Missing metadata in session:", metadata);
          return;
        }

        const plan = pricingPlans.find(p => p.id === planId);
        if (plan) {
          const now = new Date();
          const expiresAt = new Date(now.getTime() + plan.durationHours * 60 * 60 * 1000);

          // Find user by email
          const userEmail = session.customer_details?.email;
          let userId = null;
          if (userEmail) {
            const [user] = await db.select().from(users).where(eq(users.email, userEmail)).limit(1);
            if (user) userId = user.id;
          }

          console.log(`[Webhook] Creating reservation for user ${userId || 'guest'} on number ${phoneNumberId}`);

          const existing = await storage.getActiveReservation(phoneNumberId);
          if (!existing) {
            await storage.createReservation({
              phoneNumberId,
              planId,
              userId,
              sessionId: userSessionId || 'webhook',
              startsAt: now,
              expiresAt,
              isActive: true,
            });

            await storage.recordUsage({
              phoneNumberId,
              sessionId: userSessionId || 'webhook',
              usedAt: now,
              purpose: `Paid with ${plan.name} plan`,
            });
            
            await db.update(phoneNumbers)
              .set({ isAvailable: false })
              .where(eq(phoneNumbers.id, phoneNumberId));

            const [num] = await db.select().from(phoneNumbers).where(eq(phoneNumbers.id, phoneNumberId));
            if (num) {
              await telegram.notifyNewPayment({
                amount: session.amount_total || 0,
                currency: session.currency || 'eur',
                planName: plan.name,
                phoneNumber: num.number,
                country: num.country,
                userEmail: userEmail || undefined
              });
            }
          }
        }
      }
    } catch (err: any) {
      console.error("[Stripe Webhook Error]:", err.message);
    }
  }
}
