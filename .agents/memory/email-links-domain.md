---
name: Public-facing URLs must use stable production domain, not REPLIT_DOMAINS
description: Any externally-reachable URL (email links, Telegram webhook, Stripe redirects) must use PUBLIC_URL || gwadasms.com
---
Any URL that leaves the server and must be reachable later — verification/auth email links, the Telegram `setWebhook` URL, Stripe Checkout `success_url`/`cancel_url`, deep-link display URLs — must point to the stable custom domain (`process.env.PUBLIC_URL || "https://gwadasms.com"`), NEVER `REPLIT_DOMAINS`.

**Why:** `REPLIT_DOMAINS` resolves to the ephemeral dev domain (`*.worf.replit.dev`) when the URL is generated from the dev environment. Those URLs break once the dev server sleeps/changes: dead email links, Telegram "Démarrer" clicks that never reach the live server (connection never detected), post-payment redirects to a dead host.

**How to apply:** Use `(process.env.PUBLIC_URL || "https://gwadasms.com").replace(/\/+$/, "")`. Guard side-effecting registrations (e.g. `setupTelegramWebhook`) with `NODE_ENV === "production"` so the dev server never hijacks the live bot's webhook — whoever starts last wins otherwise. Note dev and production (gwadasms.com) use SEPARATE databases — a token created in dev cannot be verified against the prod domain and vice-versa.

**Telegram link gotcha:** `GET /api/reservations/:id/telegram-link` must use the SAME access model as the rest of the app (`session.userId` / `req.user.id` / guest `sessionId`), not `req.isAuthenticated()` alone — Passport-only check 401s guests and email/password users, leaving the dialog stuck on a spinner. Frontend must pass `?sessionId=` for guests.
