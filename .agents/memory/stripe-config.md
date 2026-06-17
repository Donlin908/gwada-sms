---
name: Stripe & reservation access-control rules
description: Règles durables pour paiements Stripe cohérents et accès aux données sensibles
---

## Stripe test/live
`REPLIT_DEPLOYMENT === '1'` → compte/clés/prix **live**, sinon **test**. Ce drapeau doit gouverner SIMULTANÉMENT la clé secrète/publique, les price IDs ET le compte ciblé.

**Why:** les price IDs test et live vivent dans des namespaces séparés. Un price ID test avec une clé live (ou l'inverse) renvoie "No such price" 400 → paiement échoue.

**How to apply:**
- UNE seule source de vérité pour les price IDs (helper `getStripePriceId(planId)`). Tout canal qui crée une session checkout (web, bot Telegram, futurs) l'utilise — jamais de price ID hardcodé local.
- Sélection des clés STRICTE : pas de fallback croisé test↔live.
- Ajouter un plan = créer le prix dans LES DEUX comptes et les deux maps.

## Intégrité du prix
Le prix se dérive UNIQUEMENT d'un `planId` validé côté serveur (enum), jamais d'un `priceId` envoyé par le client. Sinon un client obtient une longue durée en payant un plan moins cher.

## Reçus vs factures (paiement unique Checkout)
Le toggle Stripe Dashboard « Reçus de paiements réussis » envoie des REÇUS, pas des FACTURES. Pour un Checkout `mode:'payment'` (paiement unique), Stripe ne génère PAS de facture conforme sans `invoice_creation: { enabled: true }` dans la création de session (code). Le dashboard ne contrôle que la mise en forme (logo, SIREN/TVA). **Why:** conformité SASU exige des factures numérotées ; sans ce flag, aucune facture auto.

## Accès aux données sensibles (SMS, tokens)
Les endpoints qui renvoient du contenu SMS ou des identifiants Telegram sont accessibles sans login (flux invité), donc ils sont des cibles IDOR : l'ID de numéro est public.

**Règle :** autoriser seulement (a) l'admin (`session.adminAuth`), ou (b) le propriétaire d'une réservation ACTIVE sur ce numéro — utilisateur connecté (`session.userId`) ou invité dont le `sessionId` (localStorage `gwada_session_id`) correspond. Sinon 403. Ne jamais exposer `telegramToken`/`telegramChatId` bruts : renvoyer un booléen.

**Why:** l'isolation côté front ne suffit pas ; sans contrôle serveur n'importe qui peut lire les SMS d'autrui via l'ID public du numéro.

## Test e2e paiement
Le sous-agent runTest (Playwright) affiche un écran blanc sur l'URL replit.dev publique de cette app (bug d'environnement, pas l'app) : valider via API Stripe + appels d'endpoints + screenshot app_preview. Le mode live se teste avec une vraie carte par l'utilisateur (remboursable). Toujours nettoyer les données de test après.
