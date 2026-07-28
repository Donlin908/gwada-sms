# 🔄 Plan Backup VONAGE (Si Twilio MOBILE non-activé)

**Trigger:** Si Twilio ne répond pas ou refuse avant 28/07 12h

---

## 1️⃣ Créer compte Vonage (5 min)

```
https://dashboard.nexmo.com/sign-up
Email: dl.tech971@gmail.com
Pays: Guadeloupe
```

**Crédits gratuits:** $2 pour démarrer

---

## 2️⃣ Acheter numéros VONAGE MOBILE (10 min)

**Dashboard Vonage:**
```
Products → Numbers → Buy Numbers

Critères:
  Pays: United States
  Type: MOBILE ✅ (disponible contrairement à Twilio limité)
  Features: SMS ✅
  Quantity: 3 USA + 2 CA = 5 total

Prix: ~$2.00/mois chaque numéro
```

---

## 3️⃣ Intégrer Vonage dans code (30 min)

**Fichier nouveau:** `server/vonage-service.ts`

```typescript
import { Vonage } from "@vonage/server-sdk";

const vonage = new Vonage({
  apiKey: process.env.VONAGE_API_KEY!,
  apiSecret: process.env.VONAGE_API_SECRET!,
});

export async function searchAvailableNumbers(
  countryCode: string,
  limit: number = 5
): Promise<AvailableNumberToPurchase[]> {
  // Vonage API pour rechercher numéros disponibles
  const response = await vonage.number.search(countryCode, {
    features: ["SMS"],
    type: "mobile", // ✅ Vonage supporte MOBILE pour USA/CA
    size: limit,
  });

  return response.numbers.map(num => ({
    phoneNumber: num.phoneNumber,
    friendlyName: num.phoneNumber,
    country: countryCode,
    smsCapable: true,
    numberType: "mobile", // ✅ Garanti MOBILE
    // ...
  }));
}
```

**Variables d'env Replit:**
```
VONAGE_API_KEY=xxxx
VONAGE_API_SECRET=yyyy
```

---

## 4️⃣ Modifier `number-purchase.ts`

```typescript
// Remplacer Twilio → Vonage
import { searchAvailableNumbers as vonageSearch } from "./vonage-service";

export async function autoSearchAvailableNumbers(
  criteria: NumberFilterCriteria,
  limit: number = 5
): Promise<AvailableNumberToPurchase[]> {
  // VONAGE au lieu de Twilio
  const providers = ["vonage"]; // ["twilio"] → ["vonage"]
  
  // Même logique, provider différent
}
```

---

## 5️⃣ Acheter numéros via API (5 min)

```typescript
const response = await vonage.number.buy(phoneNumber, countryCode);
if (response.id) {
  console.log(`✅ Numéro ${phoneNumber} acheté via Vonage`);
}
```

---

## 6️⃣ Tests SMS Vonage (15 min)

```typescript
await vonage.message.sendSms(
  "GWADA", // Sender ID
  "+1234567890", // Recipient
  "Test SMS Vonage" // Message
);
```

---

## 📊 Vonage vs Twilio

| Aspect | Twilio | Vonage |
|--------|--------|--------|
| **MOBILE USA/CA** | ⏳ Activation requise | ✅ Disponible |
| **Prix** | $1.25/mois | $2.00/mois |
| **SMS API** | Simple | Très simple |
| **Support** | 24-48h | Réponse rapide |
| **Documentation** | Excellent | Bon |

---

## ⏱️ Timeline Backup

```
Si Twilio refuse/timeout (>28/07 12h):

1. Créer compte Vonage (5 min)
2. Acheter 5 numéros MOBILE (10 min)
3. Intégrer code (30 min)
4. Tests SMS (15 min)
5. Release numéros Twilio
6. Acheter via Vonage

Total: 1h (peut paralléliser avec attente Twilio)
```

---

## 🚨 Décision FINALE (28/07 12h)

```
SI Twilio ✅ → Utiliser Twilio (déjà intégré)
SI Twilio ❌ → Basculer Vonage (plan B exécuté)
```

---

**Créé:** 27/07/2026 20h30
**Status:** Prêt à exécuter si besoin
