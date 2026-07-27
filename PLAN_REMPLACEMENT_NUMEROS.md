# 🔄 Plan de Remplacement Numéros USA/CA

## 📊 Audit actuels (avant remplacement)

**Numéros en base (12 total):**
```
CA Canada (3):
  ✅ +13434593092 (Twilio, Libre) — À vérifier
  ✅ +12892748170 (Twilio, Libre) — À vérifier
  ✅ +18259071361 (Twilio, Libre) — À vérifier

US USA (9):
  ✅ +12282251657 (Twilio, Libre) — À vérifier
  ⚠️  +17179155516 (Twilio, 1/10, Qualité 0%) — PROBABLEMENT LOCAL
  ✅ +16616056422 (Twilio, Libre) — À vérifier
  ✅ +15076985897 (Twilio, Libre) — À vérifier
  ✅ +13527903279 (Twilio, Libre) — À vérifier
  ❌ +18207775864 (Twilio, Réservé, 0%) — LOCAL CONFIRMÉ
  ✅ +12707149997 (Twilio, Libre) — À vérifier
  ❌ +19802840149 (Telnyx, Réservé, 100%) — LOCAL CONFIRMÉ
```

**Query SQL pour audit complet:**
```sql
SELECT number, country, provider, "isAvailable", "usageCount"
FROM phone_numbers
WHERE country IN ('us', 'ca')
ORDER BY country, "isAvailable" DESC;
```

---

## ⚠️ CHANGEMENT D'ARCHITECTURE (27/07/2026 19h30)

**Telnyx déclaré NON-VIABLE pour SMS :**
- France: mobile/local/national → AUCUN ne supporte SMS
- USA/CA: local uniquement (pas mobile) → risque rejet Klarna
- Seul WhatsApp fonctionne → pas OTP/SMS

**Décision: TWILIO SEUL pour production**
- Twilio supporte .mobile.list() pour USA/CA ✅
- Twilio supporte tous types pour FR ✅
- Architecture simplifiée (pas fallback multi-provider)

---

## 🎯 Étapes de remplacement

### Étape 1 : Release numéros LOCAL (1h)

**Identifiés comme problématiques:**
- ❌ +18207775864 (Twilio) → `twilioSid: ?`
- ❌ +19802840149 (Telnyx) → `telnyxId: ?`

**À vérifier & potentiellement remplacer:**
- ⚠️  +17179155516 (Twilio, 1/10) — Qualité 0%

**Actions:**
```typescript
// 1. Pour chaque numéro LOCAL, lire le SID depuis DB
const localNumbers = [
  { number: '+18207775864', provider: 'twilio', sid: 'PN...' },
  { number: '+19802840149', provider: 'telnyx', sid: '+1...' },
];

// 2. Appeler release API
for (const num of localNumbers) {
  if (num.provider === 'twilio') {
    await twilioClient.incomingPhoneNumbers(num.sid).remove();
  } else {
    await telnyxClient.deletePhoneNumber(num.number);
  }
}

// 3. Marquer en DB comme "deleted"
UPDATE phone_numbers SET "deletedAt" = NOW() WHERE number IN (+18207775864, +19802840149);
```

**Coût:** ~$1-2 par numéro (frais Twilio/Telnyx)

---

### Étape 2 : Acheter numéros MOBILE TWILIO SEUL

**Critères de recherche (TWILIO UNIQUEMENT):**

```typescript
const criteria = {
  country: 'us' | 'ca' | 'fr',
  numberType: OptimalNumberType.MOBILE, // STRICTEMENT MOBILE
  requireSmsCapable: true,
  excludeRegulatoryReqs: true,
};

// Logique TWILIO uniquement:
// - USA/CA: .mobile.list() → garantit MOBILE
// - FR: .mobile.list() → numéros +336/+337 (SMS OK)
// - Pas de fallback Telnyx (Telnyx n'a pas SMS fiable)
```

**Nombres à acheter via TWILIO :**
- Replace +18207775864 (US) → 1 MOBILE USA
- Replace +19802840149 (Telnyx) → 1 MOBILE USA  
- Potentiel +17179155516 (US) → 1 MOBILE USA
- **Optionnel:** Ajouter 2 numéros MOBILE supplémentaires (buffer pool)

**Coût:** ~$1.25/mois par numéro (Twilio uniquement)

---

### Étape 3 : Valider qualité numéros MOBILE (1h)

**Pour chaque numéro acheté:**

```typescript
// Envoyer un SMS de test
const result = await smsProvider.sendMessage({
  to: '+1820775586X', // Test numéro
  from: '+1NEWMOBILEXX',
  text: 'SMS test depuis GWADA — OTP compatible',
});

// Vérifier dans les logs Telnyx/Twilio
// Statut attendu: "delivered" ou "sent"
```

**Checklist qualité:**
- [ ] SMS envoyé avec succès
- [ ] Pas d'erreur "carrier restricted"
- [ ] Pas d'erreur "invalid number"
- [ ] Délai < 5s (immédiat)
- [ ] Pas de rejet Klarna sur premier achat test

---

### Étape 4 : Mettre à jour privacy policy (30 min)

**Ajouter à la section "Sous-traitants":**

```
Fournisseurs SMS:
- Twilio (USA/CA) — Traitement SMS en temps réel
- Telnyx (USA/CA/FR) — Backup SMS, lookup numéros

Données traitées:
- Numéros téléphone sources (SMS entrants)
- Contenu SMS (stocké 30 jours max)
- Métadonnées délivrance (timestamp, carrier)
```

---

### Étape 5 : Tests finaux (1-2h)

**Avant déclaration "LIVE":**

```
1. Réserver numéro USA via web
2. Payer via Stripe
3. Recevoir OTP SMS
4. Vérifier OTP dans app
5. Tester sur Klarna (confirmation pas rejeté)
6. Tester sur Google, WhatsApp, Amazon
```

**Acceptance criteria:**
- ✅ OTP reçu en < 30s
- ✅ Pas de rejet Klarna/banques
- ✅ Pas de rejet SMS carrier

---

## 📅 Timeline

| Étape | Durée | Début | Fin |
|-------|-------|-------|-----|
| Release LOCAL | 30 min | 27/07 19h | 27/07 19h30 |
| Acheter MOBILE | 30 min | 27/07 19h30 | 27/07 20h |
| Valider qualité | 1h | 27/07 20h | 27/07 21h |
| Update privacy | 30 min | 27/07 21h | 27/07 21h30 |
| Tests finaux | 2h | 27/07 21h30 | 27/07 23h30 |
| **TOTAL** | **4h30** | **27/07 19h** | **27/07 23h30** |

**Risques:**
- ⚠️ Twilio/Telnyx pas de numéro MOBILE dispo → augmenter région recherche
- ⚠️ Délai validation Stripe > 5 min → peut retarder tests
- ⚠️ Carrier rejette numéro → retry avec autre NPA

---

## 🚀 Commandes Git finales

```bash
# Après tests réussis:
git add -A
git commit -m "Remplacer numéros LOCAL par MOBILE USA/CA — Qualité OTP validée"
git push origin main

# GitHub Actions CI:
✅ tsc
✅ npm test
✅ npm run build
✅ Gitleaks (rotate secrets si besoin)
✅ CodeQL
```

---

## ✅ Checklist avant social media

- [ ] Audit numéros existants (SQL query exécutée)
- [ ] Numéros LOCAL identifiés
- [ ] Numéros LOCAL releasés
- [ ] Numéros MOBILE achetés (log: "MOBILE — X candidat(s) bruts reçus")
- [ ] Tests OTP réussis (Klarna, Google, WhatsApp, Amazon)
- [ ] Privacy policy mise à jour (Telnyx + Twilio)
- [ ] GitHub Actions ✅ VERT
- [ ] Commit remplacement poussé

**Launch public:** 🟢 AUTORISÉ si tous les ✅

---

**Créé:** 27/07/2026
**Version:** 1.0
**Statut:** PRÊT EXÉCUTION
