---
name: Never let setEnvVars write sensitive values — .replit is git-tracked
description: STRIPE_WEBHOOK_SECRET (and similar) can end up plaintext in .replit's [userenv.shared], committed to git; use requestEnvVar instead
---
Found `STRIPE_WEBHOOK_SECRET` stored in plaintext inside `.replit` (`[userenv.shared]` section) — both in current file content and in multiple past git commits. `.replit` is a normal git-tracked file (not gitignored), so any value written there via `setEnvVars` is exposed to anyone with repo access, forever, once committed.

**Why:** `setEnvVars`/`viewEnvVars(type:"env")` persists shared env vars directly into `.replit`. Only `requestEnvVar` (type "secret") stores a value in the encrypted Secrets store that never touches a git-tracked file. A prior session apparently used the env-var path for a value that should have been a secret.

**How to apply:** Before adding any credential/token/signing-secret, use `requestEnvVar({requestType:"secret", ...})`, never `setEnvVars`. If you find a sensitive key already sitting in `.replit`, treat it as compromised: `deleteEnvVars` to remove it from the file, `requestEnvVar` to re-collect it as a real secret, and prompt the user to rotate the value at the source (Stripe/Twilio/etc dashboard) since the old value is permanently in git history — rewriting history is disproportionate; rotation neutralizes the leak. For VM/always-on deployments, the running process only picks up the new secret after a redeploy/republish (env is read once at process start) — flag this explicitly to the user rather than assuming it's already live.
