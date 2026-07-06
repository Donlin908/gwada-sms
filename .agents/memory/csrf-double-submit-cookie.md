---
name: CSRF via double-submit cookie
description: How CSRF protection was implemented without csurf/cookie-parser, and how to verify it correctly.
---

Implemented CSRF protection with a lightweight double-submit-cookie middleware directly in Express, rather than pulling in `csurf` (deprecated) or `cookie-parser`. A non-httpOnly `csrf_token` cookie is set on first request; mutating requests (POST/PUT/PATCH/DELETE) to `/api/*` must echo it back in an `X-CSRF-Token` header. External webhook routes (Stripe, Telegram) are exempted since they use signature verification instead of session cookies.

**Why:** Avoids adding dependencies for a simple pattern, and keeps behavior transparent — the frontend's shared `apiRequest()` fetch wrapper reads the cookie and attaches the header automatically, so no per-call changes were needed elsewhere in the app.

**How to apply:** When protecting new mutating routes, no extra work is needed as long as they go through the app's central `apiRequest()` helper and start with `/api`. New external webhook-style routes (no session/cookie auth, verified by signature) must be added to the CSRF exemption set in `server/index.ts`.

**Verification gotcha:** The Playwright-based e2e testing subagent was flaky/unreliable for this change (repeatedly reported a stuck "Running" placeholder on `/auth` even though direct `screenshot` calls and manual curl-based request flows worked fine). When e2e testing behaves this way, cross-check with direct `curl` request simulate (register/login using cookies + manually setting the CSRF header) and the `screenshot` app_preview tool before assuming a real bug — it may be a testing-infra flake, not a code issue. Also note: cookies marked `secure: true` (from `NODE_ENV=production`) won't be stored/sent by curl over plain `http://localhost` — this is expected and not a bug; production traffic is always https.
