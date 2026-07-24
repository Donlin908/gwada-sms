---
name: Replit package-lock.json registry URLs
description: package-lock.json generated in Replit contains internal proxy URLs that break external CI (GitHub Actions).
---

## Rule

`package-lock.json` generated inside Replit will have ~15% of `resolved` URLs pointing to `http://package-firewall.replit.local/npm/` instead of `https://registry.npmjs.org/`. These internal URLs are unreachable from any external environment (GitHub Actions, Vercel, Docker, etc.), causing all package managers to fail silently.

**Symptoms:**
- npm: "Exit handler never called!" after ~70s
- bun: "ConnectionRefused downloading tarball X"
- yarn: hangs or fails with network errors

**Fix:** Replace all internal URLs before committing or in CI setup:
```python
with open('package-lock.json', 'r') as f:
    content = f.read()
fixed = content.replace('http://package-firewall.replit.local/npm/', 'https://registry.npmjs.org/')
with open('package-lock.json', 'w') as f:
    f.write(fixed)
```

**Why:** Replit routes npm traffic through an internal firewall/caching proxy. The proxy rewrites `resolved` URLs in the lockfile to point to itself. External environments can't reach `package-firewall.replit.local`.

**How to apply:** Any time the project's GitHub CI starts failing with npm/bun/yarn network errors, check `package-lock.json` for `package-firewall.replit.local` entries and replace them. Run the fix script locally and commit the updated lockfile. Consider adding it as a pre-push git hook.
