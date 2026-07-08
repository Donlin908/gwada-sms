---
name: Telegram webhook authentication
description: How the Telegram webhook secret_token is generated and verified to prevent unauthenticated admin command injection.
---

# Telegram Webhook Authentication

## The Rule
Always verify `X-Telegram-Bot-Api-Secret-Token` at the top of the `/api/telegram/webhook` handler before processing any update. Reject with 403 if missing or wrong.

**Why:** Without this check, anyone who guesses or knows the admin `TELEGRAM_CHAT_ID` (publicly inferrable) can POST a forged Telegram update and trigger real Twilio purchases or flip maintenance mode.

**How to apply:** When registering the webhook via `setWebhook`, pass `secret_token`. When handling incoming webhook POSTs, compute the expected secret and compare with the header before any business logic.

## Implementation

The secret is derived deterministically from the existing `TELEGRAM_BOT_TOKEN` — no new env var required:

```ts
function getTelegramWebhookSecret(token: string): string {
  return crypto.createHmac("sha256", token)
    .update("gwada-telegram-webhook")
    .digest("hex")
    .slice(0, 64); // Telegram allows [A-Za-z0-9_-]{1,256}; hex fits
}
```

- `server/index.ts` → `setupTelegramWebhook()`: pass `secret_token: getTelegramWebhookSecret(token)` in the `setWebhook` body.
- `server/routes.ts` → `/api/telegram/webhook` handler: compute expected, read `req.headers["x-telegram-bot-api-secret-token"]`, return 403 if mismatch.

## Verification
```bash
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:5000/api/telegram/webhook \
  -H "Content-Type: application/json" \
  -d '{"message":{"chat":{"id":"123456"},"text":"/acheter france"}}'
# Expected: 403
```
