/**
 * Moteur d'achat multi-provider avec fallback automatique
 * Trie et achète les numéros en appliquant les mêmes filtres que Telnyx/Twilio
 */

import { getProvider, allConfiguredProviders } from "./sms-provider";
import type { AvailableNumberToPurchase, PurchasedNumber } from "./sms-provider";
import type { Country } from "@shared/schema";

/**
 * Type de numéro optimal pour OTP/SMS transactionnel
 */
export enum OptimalNumberType {
  MOBILE = "mobile",           // Meilleure délivrabilité, carrier-based
  LOCAL = "local",              // Standard, géographique
  TOLL_FREE = "toll_free",      // Moins fiable pour OTP (souvent bloqué)
}

/**
 * Critères de tri pour numéros (appliqués aussi chez Telnyx/Twilio)
 */
export interface NumberFilterCriteria {
  country: string;             // US, CA, FR
  numberType?: OptimalNumberType;
  region?: string;             // Ex: "IL" (Illinois), "75" (Paris), etc.
  requireSmsCapable: boolean;
  requireMmsCapable?: boolean;
  excludeRegulatoryReqs?: boolean; // Exclure numéros avec exigences réglementaires
}

/**
 * Recherche numéros disponibles multi-provider avec fallback automatique
 * Essaye provider 1 → si rien, provider 2 → etc.
 *
 * @param criteria Filtres à appliquer (type, région, SMS capable, etc.)
 * @param limit Nombre de numéros à retourner
 * @returns Liste triée de numéros disponibles
 */
export async function autoSearchAvailableNumbers(
  criteria: NumberFilterCriteria,
  limit: number = 5
): Promise<AvailableNumberToPurchase[]> {
  // ⚠️  TWILIO SEUL — Telnyx ne supporte pas SMS fiable
  // (Telnyx France: mobile/local/national n'ont pas SMS; USA/CA: local seulement)
  // Seul WhatsApp sur Telnyx, pas OTP/SMS
  const providers = ["twilio"];

  if (providers.length === 0) {
    console.error("[NumberPurchase] Twilio non configuré");
    return [];
  }

  const providerOrder = providers;

  let results: AvailableNumberToPurchase[] = [];

  for (const providerName of providerOrder) {
    try {
      const provider = getProvider(providerName);
      console.log(`[NumberPurchase] Recherche ${providerName} pour ${criteria.country}...`);

      const available = await provider.searchAvailableNumbers(criteria.country, limit * 2);

      // Filtrer selon les critères
      const filtered = filterNumbers(available, criteria);

      if (filtered.length >= limit) {
        // Assez de résultats, pas besoin de fallback
        console.log(`[NumberPurchase] ✅ ${providerName}: ${filtered.length} numéro(s) trouvé(s)`);
        return filtered.slice(0, limit);
      } else if (filtered.length > 0) {
        // Résultats partiels — accumuler et essayer provider suivant
        console.log(`[NumberPurchase] ⚠️  ${providerName}: ${filtered.length}/${limit} numéro(s), essai fallback...`);
        results = [...results, ...filtered];
      } else {
        console.warn(`[NumberPurchase] ❌ ${providerName}: 0 numéro trouvé, essai provider suivant...`);
      }
    } catch (err: any) {
      console.error(`[NumberPurchase] Erreur ${providerName}: ${err.message}`);
      // Continuer avec le provider suivant
    }
  }

  return results.slice(0, limit);
}

/**
 * Achète un numéro avec fallback automatique entre providers
 * Essaye le provider principal → si échoue, essaye autres providers
 *
 * @param number Numéro à acheter (ex: "+1 (312) 555-0101")
 * @param primaryProvider Provider préféré (ex: "twilio"), puis fallback automatique
 * @param providerData Données spécifiques au provider (ex: bundle ID pour Telnyx France)
 * @returns Numéro acheté + SID, ou null si tous les providers ont échoué
 */
export async function autoFallbackPurchase(
  number: string,
  primaryProvider: string = "twilio",
  providerData?: Record<string, unknown>
): Promise<{ provider: string; purchased: PurchasedNumber } | null> {
  // ⚠️  TWILIO SEUL — Telnyx ne supporte pas SMS
  const providerOrder = ["twilio"];

  for (const providerName of providerOrder) {
    try {
      console.log(`[NumberPurchase] Achat ${number} via ${providerName}...`);
      const provider = getProvider(providerName);

      const purchased = await provider.purchasePhoneNumber(
        number,
        number,        // friendlyName = number
        true,          // smsCapable = true (requirement)
        providerData   // Passe bundle ID, etc. si fourni
      );

      if (purchased) {
        console.log(`[NumberPurchase] ✅ ${providerName}: ${number} acheté`);
        return { provider: providerName, purchased };
      }
    } catch (err: any) {
      const userMsg = err?.userMessage || err?.message || "Erreur inconnue";
      console.warn(`[NumberPurchase] ❌ ${providerName} échoué: ${userMsg}`);
      // Continuer avec le provider suivant
    }
  }

  console.error(`[NumberPurchase] 💥 Achat ${number} échoué sur TOUS les providers`);
  return null;
}

/**
 * Filtre une liste de numéros selon les critères (appliqué après recherche API)
 * Simule les filtres Telnyx/Twilio pour cohérence
 */
function filterNumbers(
  numbers: AvailableNumberToPurchase[],
  criteria: NumberFilterCriteria
): AvailableNumberToPurchase[] {
  return numbers.filter(num => {
    // SMS obligatoire
    if (criteria.requireSmsCapable && !num.smsCapable) {
      return false;
    }

    // MMS optionnel
    if (criteria.requireMmsCapable && !num.mmsCapable) {
      return false;
    }

    // Exclure numéros avec exigences réglementaires (pour achat automatique)
    if (criteria.excludeRegulatoryReqs && num.addressRequired) {
      return false;
    }

    // Filtrer par type (STRICTEMENT MOBILE pour US/CA OTP — pas de fallback LOCAL)
    if (criteria.numberType === OptimalNumberType.MOBILE) {
      // REJETER TOUT sauf "mobile" : VoIP, TOLL_FREE, LOCAL, unknown → tous incompatibles
      if (num.numberType !== "mobile") {
        console.warn(`[NumberPurchase] ⛔ Rejeter ${num.phoneNumber}: type=${num.numberType} (STRICTEMENT MOBILE requis)`);
        return false;
      }
    }

    // Filtrer par région (ex: "IL" pour Illinois)
    if (criteria.region) {
      // Pour Twilio/Telnyx local numbers, extraire la région (complexe)
      // À améliorer avec meilleure parsing
    }

    return true;
  });
}

/**
 * Aide au choix optimal de type de numéro selon le pays
 */
export function optimalNumberTypeForCountry(country: string): OptimalNumberType {
  switch (country.toUpperCase()) {
    case "US":
    case "CA":
      return OptimalNumberType.MOBILE;  // Meilleure délivrabilité OTP
    case "FR":
      return OptimalNumberType.LOCAL;   // Respect réglementation
    default:
      return OptimalNumberType.LOCAL;
  }
}
