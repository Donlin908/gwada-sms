import { getUncachableStripeClient } from "./stripeClient";
import { sendMessage } from "./telegram-service";
import { storage } from "./storage";
import { db } from "./db";
import { reservations, phoneNumbers } from "../shared/schema";
import { sql } from "drizzle-orm";

let lastDailyReportDay = -1;
let last48hAlertDay = -1;

export async function getStripeRevenueForPeriod(startDate: Date, endDate: Date): Promise<{ total: number; count: number }> {
  try {
    const stripe = await getUncachableStripeClient();
    let total = 0;
    let count = 0;
    let hasMore = true;
    let startingAfter: string | undefined = undefined;

    while (hasMore) {
      const params: any = {
        limit: 100,
        created: {
          gte: Math.floor(startDate.getTime() / 1000),
          lt: Math.floor(endDate.getTime() / 1000),
        },
      };
      if (startingAfter) params.starting_after = startingAfter;

      const intents = await stripe.paymentIntents.list(params);
      for (const intent of intents.data) {
        if (intent.status === "succeeded") {
          total += intent.amount;
          count++;
        }
      }
      hasMore = intents.has_more;
      if (hasMore && intents.data.length > 0) {
        startingAfter = intents.data[intents.data.length - 1].id;
      }
    }
    return { total, count };
  } catch (err: any) {
    console.error("[BotScheduler] Erreur Stripe:", err.message);
    return { total: 0, count: 0 };
  }
}

export async function sendDailyReport(): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) return;

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const startOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0);
  const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

  const { total, count } = await getStripeRevenueForPeriod(startOfYesterday, endOfYesterday);

  const franceNumbers = await storage.getPhoneNumbers("france");
  const usaNumbers = await storage.getPhoneNumbers("usa");
  const allNumbers = [...franceNumbers, ...usaNumbers];
  const validNumbers = allNumbers.filter((n: any) => n.isValid);
  const availableNumbers = allNumbers.filter((n: any) => n.isAvailable && n.isValid);

  const activeRes = await db.execute(sql`
    SELECT COUNT(*) as count FROM reservations WHERE is_active = true AND expires_at > NOW()
  `);
  const activeCount = Number((activeRes.rows?.[0] as any)?.count ?? (activeRes as any)[0]?.count ?? 0);

  const totalEuros = (total / 100).toFixed(2).replace(".", ",");
  const dateStr = startOfYesterday.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  await sendMessage(chatId,
    `📊 <b>Rapport quotidien — ${dateStr}</b>\n\n` +
    `💰 <b>Revenus :</b> ${totalEuros} € (${count} paiement${count > 1 ? "s" : ""})\n\n` +
    `📱 <b>Numéros :</b>\n` +
    `  • Total valides : ${validNumbers.length} (🇫🇷 ${franceNumbers.filter((n: any) => n.isValid).length} / 🇺🇸 ${usaNumbers.filter((n: any) => n.isValid).length})\n` +
    `  • Disponibles : ${availableNumbers.length}\n` +
    `  • Réservations actives : ${activeCount}\n\n` +
    `🕗 Rapport généré automatiquement à 8h00`
  );

  console.log(`[BotScheduler] Rapport quotidien envoyé — ${totalEuros}€ (${count} paiements)`);
}

export async function check48hPaymentAlert(): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) return;

  const now = new Date();
  const today = now.getDate();
  if (last48hAlertDay === today) return;

  const limit48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  try {
    const stripe = await getUncachableStripeClient();
    const recent = await stripe.paymentIntents.list({
      limit: 1,
      created: { gte: Math.floor(limit48h.getTime() / 1000) },
    });

    const hasRecentPayment = recent.data.some(p => p.status === "succeeded");

    if (!hasRecentPayment) {
      last48hAlertDay = today;
      await sendMessage(chatId,
        `⚠️ <b>Alerte — Aucun paiement depuis 48h</b>\n\n` +
        `Aucun paiement confirmé détecté sur les dernières 48 heures.\n\n` +
        `Vérifiez :\n` +
        `• Votre tableau de bord Stripe\n` +
        `• La page de paiement de votre site\n` +
        `• La configuration de vos prix Stripe\n\n` +
        `📅 ${now.toLocaleString("fr-FR")}`
      );
      console.log("[BotScheduler] Alerte 48h sans paiement envoyée");
    }
  } catch (err: any) {
    console.error("[BotScheduler] Erreur check48h:", err.message);
  }
}

export function startBotScheduler(): void {
  console.log("[BotScheduler] Scheduler actif — rapport quotidien à 8h, alerte 48h activée.");

  setInterval(async () => {
    const now = new Date();
    const hour = now.getHours();
    const today = now.getDate();

    if (hour === 8 && lastDailyReportDay !== today) {
      lastDailyReportDay = today;
      await sendDailyReport();
    }

    await check48hPaymentAlert();
  }, 60 * 60 * 1000);
}
