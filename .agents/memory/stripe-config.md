---
name: Stripe test/live separation
description: Règles durables pour garder les paiements Stripe cohérents test/live dans ce projet
---

## Règle principale
`REPLIT_DEPLOYMENT === '1'` → compte/clés/prix **live**, sinon → **test**. Ce drapeau doit gouverner SIMULTANÉMENT trois choses, sinon ça casse :
1. La clé secrète/publique (server/stripeClient.ts)
2. Les price IDs (server/routes.ts → `getStripePriceId`)
3. Le compte Stripe ciblé

**Why:** les price IDs test et live vivent dans des namespaces séparés. Un price ID test envoyé avec une clé live (ou l'inverse) renvoie "No such price" 400 et le paiement échoue. Bug réel déjà rencontré : le bot Telegram avait des price IDs test hardcodés sans split → tous les achats Telegram échouaient en production.

**How to apply:**
- Une SEULE source de vérité pour les price IDs (`STRIPE_PRICE_IDS` + `getStripePriceId(planId)` dans routes.ts). Tout endroit qui crée une session checkout (site web, bot Telegram, futurs canaux) doit l'utiliser — jamais de price ID hardcodé local.
- Sélection des clés STRICTE dans stripeClient.ts : pas de fallback croisé test↔live (sinon clé live + prix test = mismatch).
- Quand on ajoute/modifie un plan, créer le prix dans LES DEUX comptes (test + live) et l'ajouter aux deux maps.

## Intégrité paiement (sécurité)
Le serveur doit dériver le prix uniquement à partir d'un `planId` validé (enum daily|weekly|monthly), JAMAIS d'un `priceId` fourni par le client. Sinon un client peut demander un plan cher (durée longue accordée via metadata.planId dans confirm-payment) tout en payant le prix d'un plan moins cher.

## Test e2e des paiements
- Le sous-agent runTest (Playwright) affiche un écran blanc "Running" sur l'URL publique replit.dev de cette app — bug d'environnement du navigateur de test, PAS un bug de l'app (`screenshot` app_preview rend correctement). Quand ça arrive, valider autrement : API Stripe + appel direct des endpoints + screenshot app_preview.
- Mode live : impossible à tester sans vraie carte ; valider seulement la config (prix actifs dans le bon compte). Le vrai test se fait par l'utilisateur sur le site publié, remboursable depuis le dashboard Stripe.
- Toujours nettoyer les données de test après (réservation + usage_history + remettre le numéro disponible).
