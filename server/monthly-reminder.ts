import { getUncachableStripeClient } from "./stripeClient";
import { sendMessage } from "./telegram-service";

let lastReminderMonth = -1;

async function getMonthlyStripeRevenue(year: number, month: number): Promise<{ total: number; count: number; currency: string }> {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);

  try {
    const stripe = await getUncachableStripeClient();
    let total = 0;
    let count = 0;
    let currency = "eur";
    let hasMore = true;
    let startingAfter: string | undefined = undefined;

    while (hasMore) {
      const params: any = {
        limit: 100,
        created: {
          gte: Math.floor(start.getTime() / 1000),
          lt: Math.floor(end.getTime() / 1000),
        },
      };
      if (startingAfter) params.starting_after = startingAfter;

      const intents = await stripe.paymentIntents.list(params);

      for (const intent of intents.data) {
        if (intent.status === "succeeded") {
          total += intent.amount;
          count++;
          currency = intent.currency;
        }
      }

      hasMore = intents.has_more;
      if (hasMore && intents.data.length > 0) {
        startingAfter = intents.data[intents.data.length - 1].id;
      }
    }

    return { total, count, currency };
  } catch (err: any) {
    console.error("[MonthlyReminder] Erreur Stripe:", err.message);
    return { total: 0, count: 0, currency: "eur" };
  }
}

export async function sendMonthlyReminder(): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) {
    console.log("[MonthlyReminder] TELEGRAM_CHAT_ID non configuré — rappel ignoré.");
    return;
  }

  const now = new Date();
  const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  const { total, count, currency } = await getMonthlyStripeRevenue(prevYear, prevMonth);

  const monthName = new Date(prevYear, prevMonth, 1).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  const totalEuros = (total / 100).toFixed(2).replace(".", ",");
  const nextMonthName = new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleDateString("fr-FR", {
    month: "long",
  });

  const message =
    `📊 <b>Rappel déclaration URSSAF — ${monthName}</b>\n\n` +
    `💰 Revenus encaissés : <b>${totalEuros} €</b>\n` +
    `📋 Nombre de paiements : <b>${count}</b>\n\n` +
    `⚠️ <b>Montant à déclarer : ${totalEuros} €</b>\n` +
    `<i>(total brut, avant déduction des frais Stripe ~1,5%)</i>\n\n` +
    `👉 Déclarez avant le 30 ${nextMonthName} sur :\n` +
    `🔗 https://www.autoentrepreneur.urssaf.fr/portail/accueil.html`;

  await sendMessage(chatId, message);
  console.log(`[MonthlyReminder] Rappel URSSAF envoyé pour ${monthName} — ${totalEuros}€ (${count} paiements)`);
}

export function startMonthlyReminder(): void {
  console.log("[MonthlyReminder] Rappel mensuel URSSAF actif — envoi le dernier jour du mois à 8h.");

  setInterval(async () => {
    const now = new Date();
    const hour = now.getHours();
    const currentMonth = now.getMonth();

    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const isLastDay = now.getDate() === lastDayOfMonth;
    const isRightHour = hour === 8;
    const alreadySent = lastReminderMonth === currentMonth;

    if (isLastDay && isRightHour && !alreadySent) {
      lastReminderMonth = currentMonth;
      await sendMonthlyReminder();
    }
  }, 60 * 60 * 1000);
}
