import { storage } from "./storage";
import { sendUsageAlert, sendNewNumberNotification, isEmailConfigured } from "./email-service";
import { searchAvailableNumbers, purchasePhoneNumber, isConfigured as isTwilioConfigured, getAllTwilioNumbers, validatePhoneNumber, checkFranceBundleApproved } from "./twilio-service";
import * as telegram from "./telegram-service";
import type { Country } from "@shared/schema";

const USAGE_ALERT_THRESHOLD = 100;
const AUTO_PURCHASE_THRESHOLD = 100;
const MIN_NUMBERS_PER_COUNTRY = 3;

export interface MonitoringStats {
  totalNumbers: number;
  franceNumbers: number;
  usaNumbers: number;
  canadaNumbers: number;
  numbersAtLimit: number;
  totalUsage: number;
  alertsSent: number;
  numbersPurchased: number;
  numbersSynced: number;
  numbersInvalidated: number;
  lastSyncAt: string | null;
}

export async function checkAndAlertHighUsage(): Promise<number> {
  const threshold = parseInt(await storage.getSetting("usage_alert_threshold") || String(USAGE_ALERT_THRESHOLD));
  const numbersAtLimit = await storage.getNumbersNearingLimit(threshold);
  
  const existingAlerts = await storage.getAllAlerts();
  const alertedNumberIds = new Set(
    existingAlerts
      .filter(a => a.alertType === "usage_limit")
      .map(a => a.phoneNumberId)
  );
  
  let alertsSent = 0;
  
  for (const number of numbersAtLimit) {
    if (alertedNumberIds.has(number.id)) {
      continue;
    }
    
    const alert = await storage.createAlert(number.id, "usage_limit", number.usageCount);
    
    const emailSent = await sendUsageAlert({
      phoneNumber: number.number,
      country: number.country,
      usageCount: number.usageCount,
      threshold,
    });

    await telegram.notifyHighUsage(number.number, number.country, number.usageCount, threshold);
    
    await storage.markAlertSent(alert.id);
    alertsSent++;
    
    if (!emailSent) {
      console.log(`Email not sent for ${number.number}, but alert recorded to prevent duplicates`);
    }
  }
  
  return alertsSent;
}

const DEFAULT_MAX_NUMBERS_PER_COUNTRY = 10;

export async function checkAndAutoPurchase(): Promise<string[]> {
  if (!isTwilioConfigured()) {
    console.log("Twilio not configured, skipping auto-purchase");
    return [];
  }
  
  const autoPurchaseEnabled = await storage.getSetting("auto_purchase_enabled");
  if (autoPurchaseEnabled !== "true") {
    console.log("Auto-purchase not enabled");
    return [];
  }
  
  const minPerCountry = parseInt(await storage.getSetting("min_numbers_per_country") || String(MIN_NUMBERS_PER_COUNTRY));
  const maxPerCountry = parseInt(await storage.getSetting("max_numbers_per_country") || String(DEFAULT_MAX_NUMBERS_PER_COUNTRY));
  
  const allNumbers = await storage.getAllPhoneNumbers();
  const purchasedNumbers: string[] = [];
  
  for (const country of ["france", "usa", "canada"] as Country[]) {
    // Tous les numéros valides (réservés ou non) — pour le plafond maximum
    const allValidForCountry = allNumbers.filter(n => n.country === country && n.isValid);
    
    // Plafond absolu : ne pas acheter si on a déjà atteint le max total
    if (allValidForCountry.length >= maxPerCountry) {
      console.log(`[Monitor] ${country.toUpperCase()} : plafond atteint (${allValidForCountry.length}/${maxPerCountry} numéros valides). Aucun achat.`);
      continue;
    }

    // Numéros disponibles pour de nouvelles réservations
    const validAvailableNumbers = allValidForCountry.filter(n => n.isAvailable);
    
    if (validAvailableNumbers.length < minPerCountry) {
      const needed = Math.min(
        minPerCountry - validAvailableNumbers.length,
        maxPerCountry - allValidForCountry.length
      );
      console.log(`[Monitor] ${country.toUpperCase()} : ${validAvailableNumbers.length}/${minPerCountry} disponibles (${allValidForCountry.length}/${maxPerCountry} total). Tentative d'achat de 1 numéro.`);
      
      const countryCode = country === "france" ? "FR" : country === "canada" ? "CA" : "US";

      if (country === "france") {
        const bundleBlocked = await storage.getSetting("france_bundle_required");
        const localBundleBlocked = await storage.getSetting("france_local_bundle_required");

        if (localBundleBlocked === "true") {
          // Cas spécifique : bundle Mobile approuvé mais seuls des numéros Local disponibles.
          // On ne tente rien tant que Twilio ne remet pas en stock des numéros Mobile FR (+336/+337).
          // Vérification légère : est-ce que des numéros Mobile FR sont revenus ?
          try {
            const mobileCheck = await (await import("twilio")).default(
              process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!
            ).availablePhoneNumbers("FR").mobile.list({ smsEnabled: true, limit: 1 });
            if (mobileCheck.length > 0) {
              await storage.setSetting("france_local_bundle_required", "false");
              console.log(`[Monitor] Numéros Mobile France de retour en stock ! Reprise de l'achat automatique France.`);
            } else {
              console.log(`[Monitor] Achat France suspendu — numéros Mobile FR toujours en rupture de stock (bundle Mobile approuvé mais seuls des Local disponibles).`);
              continue;
            }
          } catch {
            console.log(`[Monitor] Achat France suspendu — numéros Mobile FR toujours en rupture de stock.`);
            continue;
          }
        } else if (bundleBlocked === "true") {
          // Aucun bundle approuvé — vérifie si un bundle a été créé et approuvé depuis
          const isApproved = await checkFranceBundleApproved();
          if (!isApproved) {
            console.log(`[Monitor] Achat France suspendu — aucun bundle ARCEP approuvé.`);
            continue;
          }
          await storage.setSetting("france_bundle_required", "false");
          console.log(`[Monitor] Bundle ARCEP approuvé ! Reprise de l'achat automatique France.`);
        }
      }

      console.log(`Need to purchase numbers for ${country} (current: ${validAvailableNumbers.length}, min: ${minPerCountry})`);
      
      const available = await searchAvailableNumbers(countryCode, 1);
      let bundleErrorEncountered = false;
      
      for (const num of available) {
        if (!num.smsCapable) {
          console.warn(`[Monitor] Numéro ${num.phoneNumber} ignoré — non compatible SMS.`);
          continue;
        }
        let purchased = null;
        try {
          purchased = await purchasePhoneNumber(num.phoneNumber, undefined, num.smsCapable);
        } catch (err: any) {
          console.warn(`[Monitor] Achat ${num.phoneNumber} échoué : ${err?.userMessage || err?.message}`);
          purchased = null;
        }
        
        if (purchased) {
          await storage.createPhoneNumber({
            twilioSid: purchased.sid,
            number: purchased.phoneNumber,
            country,
            isAvailable: true,
            isValid: true,
          });
          
          purchasedNumbers.push(purchased.phoneNumber);
          
          const reason = `Nombre de numéros disponibles insuffisant (${validAvailableNumbers.length}/${minPerCountry})`;
          await sendNewNumberNotification({
            phoneNumber: purchased.phoneNumber,
            country,
            reason,
          });
          await telegram.notifyNumberPurchased(purchased.phoneNumber, country, reason);
        } else if (country === "france") {
          bundleErrorEncountered = true;
          break;
        }
      }

      if (bundleErrorEncountered) {
        // Vérifie si un bundle est déjà approuvé : si oui, c'est un problème de type (Mobile vs Local)
        // et non d'absence de bundle — on n'active pas le blocage pour éviter une boucle infinie
        const hasApprovedBundle = await checkFranceBundleApproved();
        if (hasApprovedBundle) {
          console.warn(
            `[Monitor] France auto-purchase suspendu — le bundle approuvé est de type Mobile mais les numéros disponibles sont de type Local. ` +
            `Créez un bundle ARCEP de type "Local" sur console.twilio.com/us1/regulatory-compliance/bundles`
          );
          await storage.setSetting("france_local_bundle_required", "true");
        } else {
          await storage.setSetting("france_bundle_required", "true");
          console.log(`[Monitor] France auto-purchase désactivé — créez un bundle ARCEP sur console.twilio.com/us1/regulatory-compliance/bundles`);
        }
      }
    }
  }
  
  return purchasedNumbers;
}

export async function syncTwilioNumbers(): Promise<{ synced: number; invalidated: number }> {
  if (!isTwilioConfigured()) {
    console.log("Twilio not configured, skipping sync");
    return { synced: 0, invalidated: 0 };
  }

  let synced = 0;
  let invalidated = 0;

  try {
    const twilioNumbers = await getAllTwilioNumbers();
    const twilioSids = new Set(twilioNumbers.map(n => n.sid));
    
    const CANADA_AREA_CODES = new Set([
      "204","226","236","249","250","289","306","343","365","387",
      "403","416","418","431","437","438","450","506","514","519",
      "548","579","581","587","604","613","639","647","705","709",
      "742","778","780","782","807","819","825","867","873","902","905",
    ]);

    for (const twilioNum of twilioNumbers) {
      const existing = await storage.getPhoneNumberByTwilioSid(twilioNum.sid);
      if (!existing) {
        let country: Country = "usa";
        if (twilioNum.phoneNumber.startsWith("+33")) {
          country = "france";
        } else if (twilioNum.phoneNumber.startsWith("+1") && twilioNum.phoneNumber.length >= 5) {
          const areaCode = twilioNum.phoneNumber.substring(2, 5);
          if (CANADA_AREA_CODES.has(areaCode)) {
            country = "canada";
          }
        }
        
        await storage.createPhoneNumber({
          twilioSid: twilioNum.sid,
          number: twilioNum.phoneNumber,
          country,
          isAvailable: true,
          isValid: twilioNum.capabilities.sms,
          lastValidatedAt: new Date(),
        });
        synced++;
        console.log(`Synced new number: ${twilioNum.phoneNumber}`);
      } else {
        // Number already in DB — always sync validity and restore availability if blocked
        const smsCapable = twilioNum.capabilities.sms;
        const needsValidityUpdate = existing.isValid !== smsCapable || !existing.lastTwilioCheck;
        const needsAvailabilityRestore = smsCapable && !existing.isAvailable;

        if (needsValidityUpdate) {
          await storage.updatePhoneNumber(existing.id, {
            isValid: smsCapable,
            lastTwilioCheck: new Date(),
          });
        } else {
          await storage.updatePhoneNumber(existing.id, { lastTwilioCheck: new Date() });
        }

        if (needsAvailabilityRestore) {
          const activeRes = await storage.getActiveReservation(existing.id);
          if (!activeRes) {
            await storage.updatePhoneNumberAvailability(existing.id, true);
            synced++;
            console.log(`Restored availability: ${twilioNum.phoneNumber}`);
          }
        } else if (needsValidityUpdate) {
          synced++;
          console.log(`Re-validated existing number: ${twilioNum.phoneNumber} (valid=${smsCapable})`);
        }
      }
    }
    
    const dbNumbers = await storage.getAllPhoneNumbers();
    for (const dbNum of dbNumbers) {
      // Only invalidate numbers with real Twilio SIDs (starting with "PN")
      // Demo/test numbers have fake SIDs that don't start with "PN"
      const hasRealTwilioSid = dbNum.twilioSid && dbNum.twilioSid.startsWith("PN");
      if (hasRealTwilioSid && !twilioSids.has(dbNum.twilioSid)) {
        await storage.updatePhoneNumber(dbNum.id, { 
          isValid: false, 
          isAvailable: false 
        });
        invalidated++;
        console.log(`Invalidated number no longer on Twilio: ${dbNum.number}`);
        await telegram.notifyNumberInvalidated(dbNum.number, dbNum.country);
      }
    }
    
    await storage.setSetting("last_twilio_sync", new Date().toISOString());
    
  } catch (error) {
    console.error("Error syncing Twilio numbers:", error);
  }

  return { synced, invalidated };
}

export async function validateExistingNumbers(): Promise<number> {
  if (!isTwilioConfigured()) {
    return 0;
  }

  let invalidated = 0;
  const allNumbers = await storage.getAllPhoneNumbers();
  
  for (const num of allNumbers) {
    if (num.twilioSid && num.isValid) {
      const isStillValid = await validatePhoneNumber(num.twilioSid);
      if (!isStillValid) {
        await storage.updatePhoneNumber(num.id, { 
          isValid: false, 
          isAvailable: false 
        });
        invalidated++;
        console.log(`Number ${num.number} is no longer valid on Twilio`);
      } else {
        await storage.updatePhoneNumber(num.id, { 
          lastValidatedAt: new Date() 
        });
      }
    }
  }

  return invalidated;
}

export async function getMonitoringStats(): Promise<MonitoringStats> {
  const allNumbers = await storage.getAllPhoneNumbers();
  const threshold = parseInt(await storage.getSetting("usage_alert_threshold") || String(USAGE_ALERT_THRESHOLD));
  const lastSyncAt = await storage.getSetting("last_twilio_sync");
  
  const totalUsage = allNumbers.reduce((sum, n) => sum + n.usageCount, 0);
  
  return {
    totalNumbers: allNumbers.length,
    franceNumbers: allNumbers.filter(n => n.country === "france").length,
    usaNumbers: allNumbers.filter(n => n.country === "usa").length,
    canadaNumbers: allNumbers.filter(n => n.country === "canada").length,
    numbersAtLimit: allNumbers.filter(n => n.usageCount >= threshold).length,
    totalUsage,
    alertsSent: 0,
    numbersPurchased: 0,
    numbersSynced: 0,
    numbersInvalidated: 0,
    lastSyncAt: lastSyncAt || null,
  };
}

export async function runMonitoringCycle(): Promise<MonitoringStats> {
  console.log("Running monitoring cycle...");
  
  const syncResult = await syncTwilioNumbers();
  const alertsSent = await checkAndAlertHighUsage();
  const purchased = await checkAndAutoPurchase();
  
  const stats = await getMonitoringStats();
  stats.alertsSent = alertsSent;
  stats.numbersPurchased = purchased.length;
  stats.numbersSynced = syncResult.synced;
  stats.numbersInvalidated = syncResult.invalidated;
  
  console.log("Monitoring cycle complete:", stats);
  return stats;
}

let monitoringInterval: NodeJS.Timeout | null = null;

export function startMonitoring(intervalMs: number = 60000): void {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
  }
  
  console.log(`Starting monitoring with ${intervalMs}ms interval`);
  
  setTimeout(() => runMonitoringCycle().catch(console.error), 120000);
  
  monitoringInterval = setInterval(() => {
    runMonitoringCycle().catch(console.error);
  }, intervalMs);
}

export function stopMonitoring(): void {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log("Monitoring stopped");
  }
}
