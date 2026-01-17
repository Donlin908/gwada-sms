import { storage } from "./storage";
import { sendUsageAlert, sendNewNumberNotification, isEmailConfigured } from "./email-service";
import { searchAvailableNumbers, purchasePhoneNumber, isConfigured as isTwilioConfigured } from "./twilio-service";
import type { Country } from "@shared/schema";

const USAGE_ALERT_THRESHOLD = 100;
const AUTO_PURCHASE_THRESHOLD = 100;
const MIN_NUMBERS_PER_COUNTRY = 3;

export interface MonitoringStats {
  totalNumbers: number;
  franceNumbers: number;
  usaNumbers: number;
  numbersAtLimit: number;
  alertsSent: number;
  numbersPurchased: number;
}

export async function checkAndAlertHighUsage(): Promise<number> {
  const threshold = parseInt(await storage.getSetting("usage_alert_threshold") || String(USAGE_ALERT_THRESHOLD));
  const numbersAtLimit = await storage.getNumbersNearingLimit(threshold);
  
  let alertsSent = 0;
  
  for (const number of numbersAtLimit) {
    const existingAlerts = await storage.getUnsentAlerts();
    const alreadyAlerted = existingAlerts.some(a => 
      a.phoneNumberId === number.id && a.alertType === "usage_limit"
    );
    
    if (!alreadyAlerted) {
      const alert = await storage.createAlert(number.id, "usage_limit", number.usageCount);
      
      const emailSent = await sendUsageAlert({
        phoneNumber: number.number,
        country: number.country,
        usageCount: number.usageCount,
        threshold,
      });
      
      if (emailSent) {
        await storage.markAlertSent(alert.id);
        alertsSent++;
      }
    }
  }
  
  return alertsSent;
}

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
  
  const threshold = parseInt(await storage.getSetting("auto_purchase_threshold") || String(AUTO_PURCHASE_THRESHOLD));
  const minPerCountry = parseInt(await storage.getSetting("min_numbers_per_country") || String(MIN_NUMBERS_PER_COUNTRY));
  
  const allNumbers = await storage.getAllPhoneNumbers();
  const purchasedNumbers: string[] = [];
  
  for (const country of ["france", "usa"] as Country[]) {
    const countryNumbers = allNumbers.filter(n => n.country === country && n.isValid);
    const availableNumbers = countryNumbers.filter(n => n.usageCount < threshold);
    
    if (availableNumbers.length < minPerCountry) {
      const needed = minPerCountry - availableNumbers.length;
      console.log(`Need to purchase ${needed} numbers for ${country}`);
      
      const countryCode = country === "france" ? "FR" : "US";
      const available = await searchAvailableNumbers(countryCode, needed);
      
      for (const num of available.slice(0, needed)) {
        const purchased = await purchasePhoneNumber(num.phoneNumber);
        
        if (purchased) {
          await storage.createPhoneNumber({
            twilioSid: purchased.sid,
            number: purchased.phoneNumber,
            country,
            isAvailable: true,
            isValid: true,
          });
          
          purchasedNumbers.push(purchased.phoneNumber);
          
          await sendNewNumberNotification({
            phoneNumber: purchased.phoneNumber,
            country,
            reason: `Nombre de numéros disponibles insuffisant (${availableNumbers.length}/${minPerCountry})`,
          });
        }
      }
    }
  }
  
  return purchasedNumbers;
}

export async function getMonitoringStats(): Promise<MonitoringStats> {
  const allNumbers = await storage.getAllPhoneNumbers();
  const threshold = parseInt(await storage.getSetting("usage_alert_threshold") || String(USAGE_ALERT_THRESHOLD));
  
  return {
    totalNumbers: allNumbers.length,
    franceNumbers: allNumbers.filter(n => n.country === "france").length,
    usaNumbers: allNumbers.filter(n => n.country === "usa").length,
    numbersAtLimit: allNumbers.filter(n => n.usageCount >= threshold).length,
    alertsSent: 0,
    numbersPurchased: 0,
  };
}

export async function runMonitoringCycle(): Promise<MonitoringStats> {
  console.log("Running monitoring cycle...");
  
  const alertsSent = await checkAndAlertHighUsage();
  const purchased = await checkAndAutoPurchase();
  
  const stats = await getMonitoringStats();
  stats.alertsSent = alertsSent;
  stats.numbersPurchased = purchased.length;
  
  console.log("Monitoring cycle complete:", stats);
  return stats;
}

let monitoringInterval: NodeJS.Timeout | null = null;

export function startMonitoring(intervalMs: number = 60000): void {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
  }
  
  console.log(`Starting monitoring with ${intervalMs}ms interval`);
  
  runMonitoringCycle().catch(console.error);
  
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
