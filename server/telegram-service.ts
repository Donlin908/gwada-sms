function getToken(): string { return process.env.TELEGRAM_BOT_TOKEN || ""; }
function getChatId(): string { return process.env.TELEGRAM_CHAT_ID || ""; }

export function isConfigured(): boolean {
  return !!getToken();
}

async function sendAdminMessage(text: string, parseMode: "HTML" | "Markdown" = "HTML"): Promise<boolean> {
  const token = getToken();
  const chatId = getChatId();
  if (!token || !chatId) {
    console.log("[Telegram] Admin non configuré — message ignoré:", text.slice(0, 80));
    return false;
  }
  return sendMessage(chatId, text, parseMode);
}

export async function sendMessage(chatId: string, text: string, parseMode: "HTML" | "Markdown" = "HTML"): Promise<boolean> {
  const token = getToken();
  if (!token) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });
    const data = await res.json() as any;
    if (!data.ok) {
      console.error("[Telegram] Erreur API:", data.description);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error("[Telegram] Erreur réseau:", err.message);
    return false;
  }
}

// ─── Alertes Surveillance ───────────────────────────────────────────────

export async function notifyNewUser(email: string, name: string | null, method: string): Promise<void> {
  const who = name ? `<b>${name}</b> (${email})` : `<b>${email}</b>`;
  const methodLabel = method === "google" ? "Google" : "Email/Mot de passe";
  await sendAdminMessage(
    `👤 <b>Nouveau compte créé</b>\n` +
    `Utilisateur : ${who}\n` +
    `Méthode : ${methodLabel}\n` +
    `📅 ${new Date().toLocaleString("fr-FR")}`
  );
}

export async function notifyUserLogin(email: string, name: string | null, method: string): Promise<void> {
  const who = name ? `<b>${name}</b> (${email})` : `<b>${email}</b>`;
  const methodLabel = method === "google" ? "Google" : "Email/Mot de passe";
  await sendAdminMessage(
    `🔑 <b>Connexion</b>\n` +
    `Utilisateur : ${who}\n` +
    `Méthode : ${methodLabel}\n` +
    `📅 ${new Date().toLocaleString("fr-FR")}`
  );
}

export async function notifyNewPayment(options: {
  amount: number;
  currency: string;
  planName: string;
  phoneNumber: string;
  country: string;
  userEmail?: string;
}): Promise<void> {
  const flag = options.country === "france" ? "🇫🇷" : "🇺🇸";
  const amountStr = (options.amount / 100).toFixed(2) + " " + options.currency.toUpperCase();
  const user = options.userEmail ? `\nClient : ${options.userEmail}` : "";
  await sendAdminMessage(
    `💳 <b>Nouveau paiement reçu</b>\n` +
    `Montant : <b>${amountStr}</b>\n` +
    `Plan : ${options.planName}\n` +
    `Numéro : ${flag} ${options.phoneNumber}${user}\n` +
    `📅 ${new Date().toLocaleString("fr-FR")}`
  );
}

export async function notifyNumberPurchased(phoneNumber: string, country: string, reason: string): Promise<void> {
  const flag = country === "france" ? "🇫🇷" : "🇺🇸";
  await sendAdminMessage(
    `📱 <b>Numéro acheté automatiquement</b>\n` +
    `Numéro : ${flag} <code>${phoneNumber}</code>\n` +
    `Raison : ${reason}\n` +
    `📅 ${new Date().toLocaleString("fr-FR")}`
  );
}

export async function notifyHighUsage(phoneNumber: string, country: string, usageCount: number, threshold: number): Promise<void> {
  const flag = country === "france" ? "🇫🇷" : "🇺🇸";
  await sendAdminMessage(
    `⚠️ <b>Numéro proche du seuil d'utilisation</b>\n` +
    `Numéro : ${flag} <code>${phoneNumber}</code>\n` +
    `Utilisations : <b>${usageCount}</b> / ${threshold}\n` +
    `📅 ${new Date().toLocaleString("fr-FR")}`
  );
}

export async function notifyNumberInvalidated(phoneNumber: string, country: string): Promise<void> {
  const flag = country === "france" ? "🇫🇷" : "🇺🇸";
  await sendAdminMessage(
    `🔴 <b>Numéro invalidé (disparu de Twilio)</b>\n` +
    `Numéro : ${flag} <code>${phoneNumber}</code>\n` +
    `📅 ${new Date().toLocaleString("fr-FR")}`
  );
}

export async function notifySmsReceived(phoneNumber: string, from: string, body: string, country: string, userEmail?: string): Promise<void> {
  const flag = country === "france" ? "🇫🇷" : "🇺🇸";
  const preview = body.length > 200 ? body.slice(0, 200) + "…" : body;
  const clientInfo = userEmail ? `\nClient : <code>${userEmail}</code>` : "";
  await sendAdminMessage(
    `📩 <b>Nouveau SMS reçu</b>\n` +
    `Sur : ${flag} <code>${phoneNumber}</code>\n` +
    `De : <code>${from}</code>\n` +
    `Message : <code>${preview}</code>${clientInfo}\n` +
    `📅 ${new Date().toLocaleString("fr-FR")}`
  );
}

export async function notifyCriticalError(context: string, error: string): Promise<void> {
  await sendAdminMessage(
    `🚨 <b>Erreur critique GWADA SMS</b>\n` +
    `Contexte : ${context}\n` +
    `Erreur : <code>${error.slice(0, 300)}</code>\n` +
    `📅 ${new Date().toLocaleString("fr-FR")}`
  );
}

export async function notifyBundleStatusChange(status: string, bundleName: string): Promise<void> {
  const emoji = status === "twilio-approved" ? "✅" : status === "twilio-rejected" ? "❌" : "🔄";
  await sendAdminMessage(
    `${emoji} <b>Bundle Twilio France — changement de statut</b>\n` +
    `Bundle : ${bundleName}\n` +
    `Nouveau statut : <b>${status}</b>\n` +
    `📅 ${new Date().toLocaleString("fr-FR")}`
  );
}

export async function sendDailyReport(stats: {
  totalNumbers: number;
  franceNumbers: number;
  usaNumbers: number;
  totalUsers: number;
  totalReservations: number;
  revenueToday: number;
}): Promise<void> {
  await sendAdminMessage(
    `📊 <b>Rapport journalier GWADA SMS</b>\n` +
    `\n📱 Numéros actifs : <b>${stats.totalNumbers}</b>\n` +
    `  🇫🇷 France : ${stats.franceNumbers}\n` +
    `  🇺🇸 USA : ${stats.usaNumbers}\n` +
    `\n👥 Utilisateurs : <b>${stats.totalUsers}</b>\n` +
    `📋 Réservations actives : <b>${stats.totalReservations}</b>\n` +
    `\n📅 ${new Date().toLocaleString("fr-FR")}`
  );
}

export async function testConnection(): Promise<boolean> {
  return sendAdminMessage(
    `✅ <b>GWADA SMS — Surveillance Telegram active</b>\n` +
    `Vous recevrez ici les alertes en temps réel :\n` +
    `• Nouveaux paiements\n` +
    `• Inscriptions\n` +
    `• SMS reçus\n` +
    `• Numéros achetés / invalidés\n` +
    `• Erreurs critiques\n` +
    `📅 ${new Date().toLocaleString("fr-FR")}`
  );
}
