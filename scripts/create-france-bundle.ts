import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const email = process.env.TWILIO_ACCOUNT_EMAIL;

if (!accountSid || !authToken) {
  console.error("[ERROR] TWILIO_ACCOUNT_SID et TWILIO_AUTH_TOKEN sont requis.");
  process.exit(1);
}

if (!email) {
  console.error("[ERROR] TWILIO_ACCOUNT_EMAIL est requis (paramètre obligatoire de l'API Twilio pour créer un bundle).");
  process.exit(1);
}

const client = twilio(accountSid, authToken);

async function createFranceBundle(): Promise<string> {
  console.log("[Twilio] Recherche de la réglementation ARCEP France (local, business)...");

  const regulations = await client.numbers.v2.regulatoryCompliance.regulations.list({
    isoCountry: "FR",
    numberType: "local",
    limit: 20,
  });

  console.log(`[Twilio] ${regulations.length} réglementation(s) trouvée(s) pour France local:`);
  for (const reg of regulations) {
    console.log(`  - SID: ${reg.sid} | Nom: ${reg.friendlyName}`);
  }

  const arcepReg =
    regulations.find((r) => r.friendlyName?.toLowerCase().includes("business")) ||
    regulations[0];

  if (!arcepReg) {
    console.error("[ERROR] Aucune réglementation France locale trouvée.");
    process.exit(1);
  }

  console.log(`[Twilio] Réglementation sélectionnée: ${arcepReg.sid} (${arcepReg.friendlyName})`);
  console.log("[Twilio] Création du bundle 'GWADA SMS France'...");

  const newBundle = await client.numbers.v2.regulatoryCompliance.bundles.create({
    friendlyName: "GWADA SMS France",
    regulationSid: arcepReg.sid,
    isoCountry: "FR",
    numberType: "local",
    email,
    statusCallback: "",
  });

  const consoleUrl = `https://console.twilio.com/us1/regulatory-compliance/bundles/${newBundle.sid}`;

  console.log("\n========================================");
  console.log("[SUCCESS] Nouveau bundle créé avec succès !");
  console.log(`  SID du bundle : ${newBundle.sid}`);
  console.log(`  Nom           : ${newBundle.friendlyName}`);
  console.log(`  Statut        : ${newBundle.status}`);
  console.log(`  Pays          : FR`);
  console.log(`\n  URL Console Twilio :\n  ${consoleUrl}`);
  console.log("========================================\n");
  console.log("[INFO] Étapes suivantes :");
  console.log("  1. Ouvrez l'URL ci-dessus dans votre navigateur");
  console.log("  2. Remplissez les informations de l'entreprise (nom, adresse, SIRET)");
  console.log("  3. Ajoutez les documents justificatifs requis");
  console.log("  4. Soumettez le bundle pour approbation Twilio");
  console.log("  5. Une fois approuvé (statut: twilio-approved), l'achat automatique de numéros FR sera débloqué");

  return newBundle.sid;
}

createFranceBundle().catch((err: Error & { code?: number }) => {
  console.error("[ERROR] Échec de la création du bundle:", err?.message || err);
  if (err?.code) console.error("  Code Twilio:", err.code);
  process.exit(1);
});
