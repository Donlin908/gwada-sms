import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

if (!accountSid || !authToken) {
  console.error("[ERROR] TWILIO_ACCOUNT_SID et TWILIO_AUTH_TOKEN sont requis.");
  process.exit(1);
}

const client = twilio(accountSid, authToken);

async function createFranceBundle() {
  console.log("[Twilio] Récupération des informations du compte Twilio...");

  const account = await client.api.accounts(accountSid!).fetch();
  const email = (account as any).email || process.env.TWILIO_ACCOUNT_EMAIL || "";

  if (!email) {
    console.warn("[WARN] Email du compte Twilio non disponible — utilisation d'un email par défaut.");
  } else {
    console.log(`[Twilio] Email du compte: ${email}`);
  }

  console.log("[Twilio] Recherche de la réglementation ARCEP France...");

  const regulations = await client.numbers.v2.regulatoryCompliance.regulations.list({
    isoCountry: "FR",
    numberType: "local",
    limit: 20,
  });

  console.log(`[Twilio] ${regulations.length} réglementation(s) trouvée(s) pour France local:`);
  for (const reg of regulations) {
    console.log(`  - SID: ${reg.sid} | Nom: ${reg.friendlyName}`);
  }

  const arcepReg = regulations.find(r =>
    r.friendlyName?.toLowerCase().includes("business") ||
    r.friendlyName?.toLowerCase().includes("arcep") ||
    r.friendlyName?.toLowerCase().includes("france")
  ) || regulations[0];

  if (!arcepReg) {
    console.error("[ERROR] Aucune réglementation ARCEP France trouvée.");
    process.exit(1);
  }

  console.log(`[Twilio] Réglementation sélectionnée: ${arcepReg.sid} (${arcepReg.friendlyName})`);
  console.log("[Twilio] Création d'un nouveau bundle GWADA SMS France...");

  const bundleParams: any = {
    friendlyName: "GWADA SMS France",
    regulationSid: arcepReg.sid,
    isoCountry: "FR",
    numberType: "local",
  };

  if (email) {
    bundleParams.email = email;
    bundleParams.statusCallback = "";
  }

  const newBundle = await client.numbers.v2.regulatoryCompliance.bundles.create(bundleParams);

  console.log("\n========================================");
  console.log("[SUCCESS] Nouveau bundle créé avec succès !");
  console.log(`  SID du bundle : ${newBundle.sid}`);
  console.log(`  Nom           : ${newBundle.friendlyName}`);
  console.log(`  Statut        : ${newBundle.status}`);
  console.log(`  Pays          : FR`);
  console.log("\n  URL Console Twilio :");
  console.log(`  https://console.twilio.com/us1/regulatory-compliance/bundles/${newBundle.sid}`);
  console.log("========================================\n");
  console.log("[INFO] Étapes suivantes :");
  console.log("  1. Ouvrez l'URL ci-dessus dans votre navigateur");
  console.log("  2. Remplissez les informations de l'entreprise (nom, adresse, SIRET)");
  console.log("  3. Ajoutez les documents justificatifs requis");
  console.log("  4. Soumettez le bundle pour approbation Twilio");
  console.log("  5. Une fois approuvé (statut: twilio-approved), l'achat automatique de numéros FR sera débloqué");

  return newBundle.sid;
}

createFranceBundle().catch((err) => {
  console.error("[ERROR] Échec de la création du bundle:", err?.message || err);
  if (err?.code) console.error("  Code Twilio:", err.code);
  process.exit(1);
});
