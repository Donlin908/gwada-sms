---
name: Auth email links must use stable production domain
description: Why verification/auth email links must not use REPLIT_DOMAINS
---
Verification (and any user-facing) email links must point to the stable custom domain (https://gwadasms.com), not `REPLIT_DOMAINS`.

**Why:** `REPLIT_DOMAINS` resolves to the ephemeral dev domain (`*.worf.replit.dev`) when an email is sent from the dev environment. Those links break once the dev server sleeps/changes, so customers who registered hit a dead link.

**How to apply:** In `server/email-service.ts` use `process.env.PUBLIC_URL || "https://gwadasms.com"`. Set `PUBLIC_URL` per environment if QA/staging needs different links. Note dev and production (gwadasms.com) use SEPARATE databases — a token created in dev cannot be verified against the prod domain and vice-versa.
