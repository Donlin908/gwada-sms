import { db } from "./db";
import { storage } from "./storage";
import { reservations, phoneNumbers } from "@shared/schema";
import { eq, and, gt, sql } from "drizzle-orm";
import * as twilioService from "./twilio-service";
import * as telegram from "./telegram-service";

let pollInterval: NodeJS.Timeout | null = null;

async function pollOnce(): Promise<void> {
  if (!twilioService.isConfigured()) return;

  const activeReservations = await db
    .select({
      reservationId: reservations.id,
      sessionId: reservations.sessionId,
      telegramChatId: reservations.telegramChatId,
      phoneNumberId: phoneNumbers.id,
      number: phoneNumbers.number,
      country: phoneNumbers.country,
      startsAt: reservations.startsAt,
    })
    .from(reservations)
    .innerJoin(phoneNumbers, eq(reservations.phoneNumberId, phoneNumbers.id))
    .where(and(eq(reservations.isActive, true), gt(reservations.expiresAt, new Date())));

  for (const r of activeReservations) {
    try {
      // Pass reservation start date so Twilio only returns messages from that period
      const twilioMessages = await twilioService.getMessagesForNumber(r.number, r.startsAt ?? undefined);
      for (const msg of twilioMessages) {
        const existing = await storage.getMessageByTwilioSid(msg.sid);
        if (existing) continue;

        await storage.createMessage({
          phoneNumberId: r.phoneNumberId,
          twilioMessageSid: msg.sid,
          sender: msg.from,
          content: msg.body,
          receivedAt: msg.dateSent,
        });

        let userEmail: string | undefined;
        if (r.sessionId !== "admin") {
          const [u] = await db.execute(sql`
            SELECT u.email FROM reservations r
            JOIN users u ON r.user_id = u.id
            WHERE r.id = ${r.reservationId} LIMIT 1
          `);
          userEmail = (u as any)?.email;
        }

        telegram
          .notifySmsReceived(r.number, msg.from, msg.body, r.country, userEmail)
          .catch(err => console.error("[SMS Poller] notifySmsReceived:", err.message));

        if (r.telegramChatId) {
          const flag = r.country === "france" ? "🇫🇷" : r.country === "canada" ? "🇨🇦" : "🇺🇸";
          const text =
            `📩 <b>Nouveau SMS reçu</b>\n` +
            `Sur votre numéro : ${flag} <code>${r.number}</code>\n` +
            `De : <code>${msg.from}</code>\n` +
            `Message : <code>${msg.body}</code>\n` +
            `📅 ${new Date().toLocaleString("fr-FR")}`;
          telegram
            .sendMessage(r.telegramChatId, text)
            .catch(err => console.error("[SMS Poller] sendMessage:", err.message));
        }
      }
    } catch (err: any) {
      console.error(`[SMS Poller] Erreur pour ${r.number}:`, err.message);
    }
  }
}

export function startSmsPoller(intervalMs: number = 30000): void {
  if (pollInterval) clearInterval(pollInterval);
  console.log(`[SMS Poller] Démarré (intervalle ${intervalMs}ms)`);
  setTimeout(() => pollOnce().catch(console.error), 15000);
  pollInterval = setInterval(() => {
    pollOnce().catch(console.error);
  }, intervalMs);
}

export function stopSmsPoller(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}
