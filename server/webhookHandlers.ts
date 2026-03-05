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
    const event = await sync.processWebhook(payload, signature);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { phoneNumberId, planId, userSessionId } = session.metadata as any;
      const plan = pricingPlans.find(p => p.id === planId);
      
      if (plan) {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + plan.durationHours * 60 * 60 * 1000);

        // Trouver l'utilisateur par email
        const userEmail = session.customer_details?.email;
        let userId = null;
        if (userEmail) {
          const [user] = await db.select().from(users).where(eq(users.email, userEmail)).limit(1);
          if (user) userId = user.id;
        }

        console.log(`Creating reservation for user ${userId || 'guest'} on number ${phoneNumberId}`);

        await storage.createReservation({
          phoneNumberId,
          planId,
          userId,
          sessionId: userSessionId,
          startsAt: now,
          expiresAt,
          isActive: true,
        });

        await storage.recordUsage({
          phoneNumberId,
          sessionId: userSessionId,
          usedAt: now,
          purpose: `Paid with ${plan.name} plan`,
        });
        
        // Mettre à jour la disponibilité du numéro
        await db.update(phoneNumbers)
          .set({ isAvailable: false })
          .where(eq(phoneNumbers.id, phoneNumberId));

        // Notifier Telegram Admin
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
}
