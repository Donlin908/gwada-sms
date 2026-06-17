---
name: Stripe test/live separation
description: Comment les clés et price IDs Stripe sont organisés dans ce projet
---

## Règle principale
Toujours séparer test et live. `REPLIT_DEPLOYMENT === '1'` → live, sinon → test.

## Clés disponibles
- `SLACK_LIVE_API_KEY_GWADASMS` — clé secrète live (sk_live_...)
- `SLACK_TEST_API_KEY_GWADA_SMS` — clé secrète test (sk_test_...)
- `STRIPE_PUBLISHABLE_KEY_LIVE` — clé publique live (pk_live_...)
- `STRIPE_PUBLISHABLE_KEY` — clé publique test (pk_test_...)

## Price IDs live (compte acct_1TdyFICi3VTHILCd)
- daily (2€) : price_1TiiAtCi3VTHILCd4WGCDIeA
- weekly (5€) : price_1TiiAuCi3VTHILCdPw3P8Ktz
- monthly (9€) : price_1TiiAuCi3VTHILCdCVv9Hv8T

## Price IDs test
- daily (2€) : price_1TiiPLCvUJHVsIHmUNNilUt9
- weekly (5€) : price_1TiiPMCvUJHVsIHmsIRfmq17
- monthly (9€) : price_1TiiPMCvUJHVsIHmJAzZZb4w

**Why:** Les price IDs test et live sont dans des namespaces séparés — utiliser un price ID test avec la clé live (ou vice versa) donne "No such price" 400.

**How to apply:** Quand on crée/modifie des prix Stripe, toujours créer les deux versions (test + live) et les hardcoder séparément dans routes.ts avec le flag isProduction.

## Test e2e des paiements
- Le sous-agent de test (runTest/Playwright) affiche un écran blanc "Running" sur l'URL publique replit.dev de cette app — bug d'environnement du navigateur de test, PAS un bug de l'app (screenshot app_preview rend parfaitement).
- **Stratégie de validation paiement fiable** : (1) valider les price IDs via Stripe API, (2) créer une session checkout via l'endpoint dev (mode test → cs_test_), (3) faire payer la carte 4242 par runTest en partant directement de l'URL checkout.stripe.com, (4) appeler /api/stripe/confirm-payment avec la session payée pour vérifier la création de réservation, (5) screenshot app_preview de /payment/success pour confirmer le rendu réel.
- Toujours nettoyer après test : DELETE reservation + usage_history (session_id LIKE 'test-e2e-%') + UPDATE phone_numbers SET is_available=true.
- Mode réel (live) : impossible de tester sans vraie carte ; valider seulement la config (compte live DLCAD&SERV acct_1TdyFICi3VTHILCd, prix actifs). Le test réel doit être fait par l'utilisateur sur le site publié, remboursable depuis le dashboard Stripe.
