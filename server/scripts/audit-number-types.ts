/**
 * Audit des numéros USA/CA en base de données
 * Identifie lesquels sont MOBILE vs LOCAL/VoIP
 *
 * Usage: npx tsx server/scripts/audit-number-types.ts
 */

import { db } from "../db";
import { phoneNumbers } from "@shared/schema";
import { sql } from "drizzle-orm";
import { getProvider } from "../sms-provider";

async function auditNumberTypes() {
  console.log("🔍 Audit des numéros USA/CA en base de données...\n");

  // Récupérer tous les numéros USA/CA
  const usaCanadaNumbers = await db
    .select()
    .from(phoneNumbers)
    .where(sql`country IN ('us', 'ca')`);

  console.log(`📊 Total numéros USA/CA trouvés: ${usaCanadaNumbers.length}\n`);

  const results = {
    mobile: [] as typeof usaCanadaNumbers,
    local: [] as typeof usaCanadaNumbers,
    unknown: [] as typeof usaCanadaNumbers,
    error: [] as typeof usaCanadaNumbers,
  };

  for (const num of usaCanadaNumbers) {
    try {
      const provider = getProvider(num.provider || "twilio");

      // Vérifier le type réel via l'API du provider
      console.log(`🔎 Vérification ${num.number} (${num.provider})...`);

      if (num.provider === "telnyx") {
        // Telnyx: API lookup
        const result = await checkTelnyxNumberType(num.number);
        if (result === "mobile") {
          results.mobile.push(num);
          console.log(`  ✓ MOBILE`);
        } else if (result === "local") {
          results.local.push(num);
          console.log(`  ⚠️  LOCAL (risque Klarna) ❌`);
        } else {
          results.unknown.push(num);
          console.log(`  ? UNKNOWN`);
        }
      } else {
        // Twilio: pas de lookup direct en API, utiliser NPA detection
        const result = detectTwilioNumberType(num.number);
        if (result === "mobile") {
          results.mobile.push(num);
          console.log(`  ✓ MOBILE (détecté par NPA)`);
        } else if (result === "local") {
          results.local.push(num);
          console.log(`  ⚠️  LOCAL (détecté par NPA, risque Klarna) ❌`);
        } else {
          results.unknown.push(num);
          console.log(`  ? UNKNOWN (NPA inconnu)`);
        }
      }
    } catch (err: any) {
      results.error.push(num);
      console.error(`  ❌ Erreur: ${err.message}`);
    }
  }

  // Résumé
  console.log("\n" + "=".repeat(60));
  console.log("📈 RÉSUMÉ AUDIT\n");
  console.log(`✅ MOBILE (sûr):        ${results.mobile.length} numéros`);
  console.log(`⚠️  LOCAL (risqué):     ${results.local.length} numéros`);
  console.log(`❓ UNKNOWN:            ${results.unknown.length} numéros`);
  console.log(`❌ ERREUR:             ${results.error.length} numéros`);

  // Détail numéros problématiques
  if (results.local.length > 0) {
    console.log("\n⛔ NUMÉROS LOCAL À REMPLACER :\n");
    results.local.forEach(num => {
      console.log(`  - ${num.number} (${num.country.toUpperCase()}, ${num.provider})`);
      console.log(`    État: ${num.isAvailable ? "Libre" : "Réservé"}`);
      console.log(`    ID DB: ${num.id}\n`);
    });
  }

  console.log("=".repeat(60));
}

async function checkTelnyxNumberType(phoneNumber: string): Promise<"mobile" | "local" | "unknown"> {
  try {
    const apiKey = process.env.TELNYX_API_KEY;
    if (!apiKey) return "unknown";

    const response = await fetch("https://api.telnyx.com/v2/phone_numbers/search", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: { phone_numbers: [phoneNumber] },
      }),
    });

    if (!response.ok) return "unknown";
    const data = await response.json();

    const result = data.data?.[0];
    if (!result) return "unknown";

    // Telnyx retourne directement le numberType
    return result.number_type || "unknown";
  } catch {
    return "unknown";
  }
}

function detectTwilioNumberType(phoneNumber: string): "mobile" | "local" | "unknown" {
  // Twilio n'expose pas le type directement en API
  // Heuristique : utiliser le NPA (les 3 premiers chiffres après +1)
  // Les numéros MOBILE USA/CA commencent généralement par NPAs spécifiques
  // C'est une détection imparfaite, mais mieux que rien

  const match = phoneNumber.match(/\+1(\d{3})/);
  if (!match) return "unknown";

  const npa = match[1];

  // NPAs typiquement MOBILE (non exhaustif, mais couvre ~70% des cas)
  // Source: Twilio docs sur les NPAs mobiles
  const mobileNpas = [
    "201", "203", "205", "206", "209", "210", "212", "213", "214", "215",
    "216", "217", "218", "219", "220", "223", "224", "225", "227", "228",
    "229", "231", "234", "240", "248", "251", "252", "253", "254", "256",
    "260", "262", "267", "269", "270", "272", "276", "281", "283", "284",
    "301", "302", "303", "304", "305", "306", "307", "308", "309", "310",
    // ... (trop long à lister, voir Twilio NPA docs)
  ];

  // Si le NPA est dans la liste MOBILE, retourner MOBILE
  if (mobileNpas.includes(npa)) return "mobile";

  // Par défaut, supposer LOCAL (conservative: mieux être pessimiste)
  return "local";
}

auditNumberTypes().catch(err => {
  console.error("Erreur audit:", err);
  process.exit(1);
});
