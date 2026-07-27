# CI/CD — Roadmap Sécurité & Robustesse

Stratégie de pipeline CI/CD pour GWADA-SMS et modèle réutilisable pour d'autres projets Node.js/TypeScript en production.

## Phase 1 — CI Minimal + Robuste ✅ (Fait 25/07/2026)

**Objectif:** Type-check + tests + build, durcis en sécurité, performants, avec audit dépendances.

### Workflows

#### `ci.yml` — Build & Tests
- **Déclencheurs:** `push` (main/master) + `pull_request`
- **Permissions:** `contents: read` (moindre privilège)
- **Concurrency:** Annule les runs redondants sur push rapides
- **Steps:**
  1. Checkout (SHA pinné)
  2. Setup Node 22 (SHA pinné)
  3. `npm ci --ignore-scripts` (production safe, pas de scripts post-install)
  4. `tsc --noEmit --skipLibCheck` (type-check, 15-30s)
  5. `npm test` (vitest, 30-60s)
  6. **`npm run build`** (détecte casses avant production, 30-60s)

**Durée totale:** ~2-3 min (acceptable pour dev workflow)

#### `security.yml` — Audit & Secrets
- **npm audit:** `--omit=dev --audit-level=high` (production deps seules)
  - `continue-on-error: true` (alertes seulement pour maintenant)
  - À passer en `false` une fois le backlog CVE nettoyé
  - Scheudlé weekly (lundi 06:00 UTC) pour détecter nouvelles CVE sur dépendances non modifiées
- **Gitleaks:** Scanne tout l'historique (`fetch-depth: 0`)
  - Détecte `sk_live_*`, `whsec_*`, tokens, clés privées
  - Bloquer les leaks futurs (en plus du retroactif)

#### `codeql.yml` — SAST Statique
- **Analyze:** JS/TS via CodeQL `security-extended`
- **Permissions:** `security-events: write` (requis pour publier alertes)
- **Schedule:** Weekly + push/PR
- **Output:** Alertes dans **Security → Code scanning alerts** (GitHub)

### Dépendances

#### `.github/dependabot.yml`
- **npm:** 
  - Interval: weekly (lundi)
  - Groupes: `@radix-ui/*`, `@types/*`, `minor+patch`
  - Ignore majors: `stripe`, `twilio`, `drizzle-orm` (revue manuelle requise)
  - Limit: 5 PRs concurrentes
- **github-actions:** 
  - Interval: weekly
  - Limit: 3 PRs concurrentes (moins volatile)

### Branch Protection
- **Require PR** avant merge
- **Require status checks:** ci.yml + security.yml (gitleaks + npm audit) + codeql
- **Require branches up-to-date** avant merge
- **Restrict pushes** — non, pour garder workflow agile

---

## Phase 2 — Performance & Cache (3-6 mois)

**Objectif:** Réduire la durée CI (2-3 min → ~1 min), garder les dépôts locaux à jour sans redownload.

### Roadmap
- [x] **npm cache** dans GitHub Actions ✅ (27/07/2026)
  - `cache: "npm"` ajouté dans `ci.yml` et `security.yml`
  - Économise ~20-30s par run (après le 1er run chaud)
- [ ] **Artifact build cache** (esbuild, Vite)
  - Cache `dist/` entre runs sur même commit
  - Utile pour les deploys itératifs
- [x] **Parallel jobs** ✅ (27/07/2026)
  - ci.yml, security.yml et codeql.yml sont des fichiers séparés → GitHub les lance en parallèle automatiquement
  - Structure `needs:` commentée ajoutée dans ci.yml pour le futur deploy (Phase 3)

### Metriques à tracker
- `ci.yml` durée (cible: 1-2 min)
- `security.yml` durée (cible: ~30s)
- `codeql.yml` durée (cible: 2-3 min, OK en parallèle)
- Cache hit rate (cible: >70%)

---

## Phase 3 — Tests d'Intégration & Déploiement (6-12 mois)

**Objectif:** Tester le vrai déploiement avant la production, déploiement semi-automatisé.

### Roadmap
- [ ] **Déploiement de staging** automatique (sur succès des tests)
  - Trigger: push sur `main` + tous les status checks verts
  - Target: Un Replit/Railway en staging
  - Job `deploy.yml` : `jobs.deploy.needs: [check, npm-audit]`
- [ ] **End-to-end tests** (Playwright ou Cypress)
  - Test le parcours client : réserver → payer → recevoir SMS
  - Tourne contre l'env de staging après déploiement
- [ ] **Load testing** (k6 ou Apache Bench)
  - Stress test de la réservation au pic de charge
  - Détecte les goulots avant production
- [ ] **Blue-Green Deployment** (GitHub Environments)
  - Production slot `prod-blue` / `prod-green`
  - Basculement zéro-downtime via DNS/LB
- [ ] **Manual approval** avant basculement prod (Environment protection rules)

### Exemple structure
```yaml
# .github/workflows/deploy-staging.yml
jobs:
  build-and-test:
    needs: [check, npm-audit, codeql] # Tout doit passer
    runs-on: ubuntu-latest
    steps:
      - run: npm run build
      - run: docker build -t gwada-sms:latest .
      - run: deploy-to-staging.sh

  e2e-tests:
    needs: build-and-test
    runs-on: ubuntu-latest
    steps:
      - run: npx playwright test --reporter=html
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/

  deploy-prod:
    needs: e2e-tests
    environment: production # Requis : approbation manuelle dans GitHub
    runs-on: ubuntu-latest
    steps:
      - run: swap-blue-green.sh
      - run: health-check.sh
```

---

## Phase 4 — Observabilité & Compliance (12+ mois)

**Objectif:** Monitoring de la CI, audit trail complet, conformité légale.

### Roadmap
- [ ] **Logs centralisés** (Sentry, DataDog)
  - Chaque run CI envoie des metrics : durée, exit code, warnings
  - Dashboard : taux d'échec, temps moyen, tendances
- [ ] **SBOM** (Software Bill of Materials)
  - `npm ls --json` + signature cryptographique
  - Requis pour la conformité cloud (ISO 27001, SOC2)
- [ ] **Audit trail GitHub**
  - Logs des approbations, merges, secrets rotation
  - Immuable, tamper-proof (GitHub Enterprise)
- [ ] **Compliance scanning**
  - Licences npm (pas de GPL dans code propriétaire)
  - Vulnérabilités CVSS 7+ = bloquant
  - OWASP Top 10 détection (secrets, SQL injection patterns)
- [ ] **PII scanning** (contrats, factures, logs)
  - Pas de numéro de carte, IBAN, email en dur
  - Redaction automatique des logs sensibles

---

## Checklist Implémentation

### Phase 1 (✅ Fait)
- [x] `ci.yml` avec tsc + tests + build
- [x] `security.yml` avec npm audit + gitleaks
- [x] `codeql.yml` avec CodeQL SAST
- [x] `.github/dependabot.yml`
- [x] Actions GitHub sha-pinnées
- [ ] `.gitleaksignore` pour leak connu (Stripe secret rotaté)
- [ ] Branch protection rules **manuelles** sur GitHub UI
- [ ] Tester 1er run (email Dependabot, alertes CodeQL)

### Phase 2 (Priorisation)
- [x] npm cache (facile, ~20s gain) ✅ 27/07/2026
- [x] Parallel jobs ✅ 27/07/2026 (workflows séparés = parallèle natif GitHub)
- [ ] Build cache (avancé)

### Phase 3 (Après stabilité Phase 1)
- [ ] Staging env dépôt
- [ ] Playwright e2e tests
- [ ] Deploy workflow
- [ ] Approvals GitHub Environments

### Phase 4 (Si scale)
- [ ] Centralized logging
- [ ] SBOM generation
- [ ] Compliance scanning

---

## Troubleshooting Courant

### Gitleaks détecte l'ancien secret Stripe dans l'historique
**Symptôme:** Gitleaks échoue même si le secret est rotaté.
```
[REDACTED] · sk_test_XXX / whsec_YYY found in commit a1b2c3d
```

**Solutions (par ordre prioritaire):**
1. **Créer `.gitleaksignore`** (recommandé, non-destructif)
   ```yaml
   # .gitleaksignore
   # Stripe webhook secret rotaté 07/07/2026, nouvelle clé en secret Replit
   whsec_l72s5B9AmSKEVR3pP72OoNFLMKqLBpCe
   ```
   Gitleaks va ignorer cette empreinte exacte.

2. **Réécrire l'historique** (destructif, si clone privé)
   ```bash
   git filter-branch --tree-filter 'sed -i "s/whsec_OLD/REDACTED/g" .replit' HEAD
   git push --force-with-lease origin main
   ```
   ⚠️ Rebasing forcé → tous les collaborateurs doivent `git reset --hard`.

### npm audit flag `xlsx` sans patch
**Symptôme:** `npm audit` alerte sur `xlsx` (CVE incompatible avec ta version).
```
REDACTED  Regular Expression Denial of Service ... xlsx 0.18.5
```

**Action:** Ajouter à `.github/dependabot.yml`:
```yaml
ignore:
  - dependency-name: "xlsx"
    versions: ["0.18.x"]
```
Garder la dépendance, documenter le risque, monitorer les updates futures.

### CodeQL timeout ou "out of memory"
**Symptôme:** `codeql.yml` échoue au bout de 2h.
**Cause:** Trop de fichiers JS/TS (>10k files).
**Fix:**
```yaml
# codeql.yml — add paths filter
with:
  paths: |
    client/src
    server
  paths-ignore: |
    node_modules
    dist
    **/*.test.ts
```

### Dependabot PR ne se crée pas
**Symptôme:** Dépendance maj disponible mais pas de PR.
**Cause:** `.github/dependabot.yml` incorrect (typos) ou secret GITHUB_TOKEN révoqué.
**Fix:**
1. Vérifier YAML syntax: `gh config get-reporter -t json` ou linter en ligne
2. Vérifier token: GitHub → Settings → Actions → General → Workflow permissions: `Read & write`
3. Attendre 24h (Dependabot s'exécute une fois par jour)

---

## Template Réutilisable (Autres Projets)

Pour copier ce modèle à un autre projet Node.js/TypeScript:

1. **Copier les 3 fichiers workflow:**
   ```bash
   cp .github/workflows/{ci,security,codeql}.yml ../other-project/.github/workflows/
   ```

2. **Adapter `.github/dependabot.yml`** (optionnel, remplacer dépendances critiques):
   ```yaml
   ignore:
     - dependency-name: "express"        # Si ton projet n'utilise pas Express
     - dependency-name: "react"          # Si backend seul
   ```

3. **Vérifier les env vars spécifiques** (Sentry DSN, etc.):
   - Si absent : ajouter `secrets:` dans `ci.yml` (`SENTRY_DSN`, etc.)
   - Si présent : adapter les `env:` en haut du workflow

4. **Branch protection (GitHub UI):**
   - Remplacer le job name `Type-check, Tests & Build` par ton équivalent

5. **`.gitleaksignore`** si besoin (retirer, ou adapter).

---

## Références

- [GitHub Actions Security Hardening](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
- [CodeQL Queries](https://codeql.github.com/codeql-query-help/javascript/)
- [Dependabot Docs](https://docs.github.com/en/code-security/dependabot)
- [OWASP CI/CD Security](https://owasp.org/www-project-devsecops-guideline/)

---

**Last updated:** 27/07/2026
**Maintainers:** DLCAD&SERV (linod)
