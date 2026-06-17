# GWADA SMS - Virtual SMS Number Service

## Overview

GWADA SMS is a virtual phone number service that allows users to receive SMS verification codes using French or American phone numbers. The application provides temporary virtual numbers for receiving SMS messages without requiring users to respond - ideal for account verification purposes.

**Core Purpose:** Enable users to select virtual phone numbers (France or USA) and view incoming SMS messages in real-time for verification purposes.

## Recent Changes (2026-06-17)

- **Correction Telegram (réception SMS sur @GwadasmsBot)** : le bouton « Ouvrir @GwadasmsBot » ne s'affichait jamais (spinner infini). Causes : (1) `GET /api/reservations/:id/telegram-link` exigeait `req.isAuthenticated()` (Google OAuth/Passport uniquement) → 401 pour les invités et les comptes email/mot de passe ; aligné sur le contrôle d'accès de `/api/messages` (admin OU `session.userId`/`req.user.id` OU `sessionId` invité). (2) Le frontend (`messages.tsx`) ne transmettait pas le `sessionId` invité dans la requête. (3) `setupTelegramWebhook` (server/index.ts) et les URLs de redirection Stripe utilisaient `REPLIT_DOMAINS` (domaine dev) au lieu de `PUBLIC_URL || https://gwadasms.com` → le clic « Démarrer » n'atteignait jamais le serveur live. `setupTelegramWebhook` ne s'exécute désormais qu'en production pour éviter que le serveur de dev ne détourne le webhook.

## Recent Changes (2026-03-16)

- **Intégration Sentry (monitoring erreurs)** : Ajout de `@sentry/node` (backend) et `@sentry/react` (frontend) pour capturer automatiquement les erreurs en production. Initialisation dans `server/index.ts` (middlewares HTTP et Express) et `client/src/main.tsx` (avant le rendu React). ErrorBoundary Sentry autour de l'app dans `client/src/App.tsx`. Route de test `/debug-sentry` pour vérifier l'intégration. DSN stocké en secrets d'environnement (`SENTRY_DSN` et `VITE_SENTRY_DSN`).
- **Configuration deployment** : Ajout de config autoscale pour la publication du projet (build avec npm, run avec node dist/server.js)

## Recent Changes (2026-03-05)

- **Système de compensation Plan Basique** : Admin peut signaler les numéros défaillants (bouton "Signaler"), alerte automatique quand 3+ numéros problématiques, génération de liens uniques de compensation par client (valides 72h), page `/compensation/:token` pour que le client choisisse un nouveau numéro gratuitement
- **Rate limiting** : Ajout de `express-rate-limit` sur les routes sensibles (auth: 10 tentatives/15min, admin login: 5/15min, paiement: 10/min)
- **Mode maintenance** : Toggle admin (Settings > Mode maintenance) pour afficher une page de maintenance à tous les visiteurs sauf /admin; endpoint `/api/status` publié
- **Page Contact** : `/contact` avec FAQ, email support, horaires — lien ajouté dans le footer
- **Page Compensation** : `/compensation/:token` publique — sélection de numéro, confirmation, affichage du nouveau numéro attribué

## Recent Changes

- **2026-02-23:** Added Google OAuth login via Replit Auth (OIDC)
  - Users can sign in with Google alongside email/password
  - Schema: password/username now optional, added authProvider, firstName, lastName, profileImageUrl
  - Replit Auth integration adapted to use existing users table (upsert by email)
  - Google button on login/register pages with "ou" separator
  - Routes: GET /api/login (OIDC redirect), GET /api/callback, GET /api/logout
  - Header shows profile image for social users
- **2026-02-23:** Added email verification on registration
  - Verification token (crypto.randomBytes) with 24h expiry stored in users table
  - Email sent via nodemailer (sendVerificationEmail in email-service.ts)
  - Routes: GET /api/auth/verify-email?token=, POST /api/auth/resend-verification
  - Frontend: verify-email page, verification banner on dashboard, post-registration message
- **2026-02-23:** Added user registration/login system with email/password authentication
  - express-session with PostgreSQL session store (connect-pg-simple)
  - bcryptjs password hashing, session regeneration on login
  - Auth pages: /auth (login/register), /dashboard (user reservations tracking)
  - Reservations now linked to user accounts (optional userId field)
  - Header shows login/profile dropdown when authenticated

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework:** React 18 with TypeScript
- **Routing:** Wouter (lightweight React router)
- **State Management:** TanStack React Query for server state caching and synchronization
- **Styling:** Tailwind CSS with CSS custom properties for theming (light/dark mode support)
- **Component Library:** shadcn/ui components built on Radix UI primitives
- **Build Tool:** Vite with React plugin

**Key Design Decisions:**
- Mobile-first responsive design with speed-focused UI
- Material Design 3 inspired aesthetic adapted for utility
- Inter font family for typography consistency
- Theme provider context for dark/light mode toggle
- Custom SVG flag icons (no emojis)

### Backend Architecture
- **Runtime:** Node.js with Express.js
- **Language:** TypeScript with ESM modules
- **API Style:** REST endpoints under `/api/*` prefix
- **SMS Provider:** Twilio integration for real phone numbers
- **Build Process:** esbuild for server bundling, Vite for client

**API Endpoints:**
- `GET /api/numbers?country={france|usa}` - List available phone numbers with per-plan availability, usage counts, and Twilio status
- `GET /api/numbers/:id` - Get single phone number details
- `GET /api/messages/:phoneNumberId` - Get SMS messages for a number
- `POST /api/numbers/:id/reserve` - Reserve a phone number
- `GET /api/numbers/:id/check-usage` - Check if number was used before
- `POST /api/sync-twilio-numbers` - Sync numbers from Twilio
- `GET /api/twilio/status` - Check Twilio configuration status

**Auth Endpoints:**
- `POST /api/auth/register` - Register new user (body: { username, email, password })
- `POST /api/auth/login` - Login user (body: { email, password })
- `GET /api/auth/me` - Get current authenticated user
- `POST /api/auth/logout` - Logout user
- `GET /api/user/reservations` - Get logged-in user's reservations

**Stripe Payment Endpoints:**
- `GET /api/stripe/publishable-key` - Get Stripe publishable key
- `GET /api/stripe/products` - List products with prices from Stripe
- `POST /api/stripe/create-checkout-session` - Create Stripe checkout session
- `POST /api/stripe/confirm-payment` - Confirm payment and create reservation
- `POST /api/stripe/webhook` - Stripe webhook handler (auto-managed)

### Data Storage
- **ORM:** Drizzle ORM with PostgreSQL dialect (Neon serverless)
- **Schema Location:** `shared/schema.ts`
- **Database Config:** Drizzle Kit for migrations, expects `DATABASE_URL` environment variable

**Database Tables:**
- `phone_numbers` - Virtual phone numbers with Twilio SID, country, availability, validity status
- `sms_messages` - Received SMS messages linked to phone numbers with Twilio message SID
- `reservations` - Phone number reservations with plan, session, start/expiry times
- `usage_history` - Tracks which sessions have used which numbers
- `users` - Basic user authentication (username/password)

**Data Models (API Response Types):**
- `PhoneNumberResponse` - Phone number data returned by API
- `SmsMessageResponse` - SMS message data returned by API
- `PricingPlan` - Subscription tier definitions (24h/2€, 7 days/5€, 30 days/9€)

### Project Structure
```
client/           # React frontend application
  src/
    components/   # UI components (shadcn + custom)
    pages/        # Route page components
    hooks/        # Custom React hooks
    lib/          # Utilities and query client
server/           # Express backend
  index.ts        # Server entry point
  routes.ts       # API route definitions
  storage.ts      # Database access layer
  db.ts           # Drizzle database connection
  twilio-service.ts # Twilio API integration
  static.ts       # Static file serving
shared/           # Shared types and schemas
  schema.ts       # Drizzle schema + TypeScript types
```

### Development Workflow
- `npm run dev` - Start development server with hot reload
- `npm run build` - Production build (client + server)
- `npm run db:push` - Push schema changes to database

## External Dependencies

### Twilio Integration
- **Twilio SDK** - For managing phone numbers and receiving SMS
- **Environment Variables:**
  - `TWILIO_ACCOUNT_SID` - Twilio account identifier
  - `TWILIO_AUTH_TOKEN` - Twilio authentication token
- **Note:** Currently using demo numbers. For real numbers, purchase them from Twilio console.

### Database
- **PostgreSQL** - Primary database (configured via `DATABASE_URL`)
- **@neondatabase/serverless** - Neon serverless PostgreSQL client
- **Drizzle ORM** - Type-safe database operations

### Frontend Libraries
- **@tanstack/react-query** - Server state management
- **Radix UI** - Accessible component primitives (dialog, dropdown, toast, etc.)
- **class-variance-authority** - Component variant styling
- **date-fns** - Date formatting (French locale support)
- **lucide-react** - Icon library
- **wouter** - Lightweight routing

### Build Tools
- **Vite** - Frontend bundler with HMR
- **esbuild** - Server bundling
- **TypeScript** - Type checking
- **Tailwind CSS** - Utility-first CSS

### Replit-Specific
- **@replit/vite-plugin-runtime-error-modal** - Error overlay in development
- **@replit/vite-plugin-cartographer** - Development tooling
- **@replit/vite-plugin-dev-banner** - Development banner

## Important Notes

### Getting Real Phone Numbers
To use real phone numbers instead of demo data:
1. Log into your Twilio console (console.twilio.com)
2. Purchase phone numbers (France: +33, USA: +1)
3. Numbers are **automatically synchronized** every 5 minutes
4. Or use the "Synchroniser maintenant" button in the admin dashboard for immediate sync
5. Numbers no longer on Twilio are automatically marked as invalid

### Reservation System
- Users can reserve numbers for 24h, 7 days, or 30 days
- Reservations expire automatically
- Usage history prevents the same user from using the same number twice
- Numbers become available again after reservation expires

### Number Monitoring & Auto-Purchase System
The system includes automatic monitoring for phone number usage:

**Monitoring Features:**
- Tracks usage count for each phone number
- Sends email alerts when numbers reach configurable threshold (default: 100 uses)
- Automatic purchase of new numbers when available count drops below minimum
- Runs every 5 minutes in the background

**Admin Dashboard (/admin):**
- View statistics: total numbers, per country, numbers at limit
- Configure settings: usage alert threshold, auto-purchase toggle, minimum per country
- Manual purchase buttons for France and USA numbers
- Full list of all numbers with usage statistics

**Required Environment Variables for Email Notifications:**
- `ADMIN_EMAIL` - Email address to receive alerts
- `SMTP_HOST` - SMTP server hostname
- `SMTP_PORT` - SMTP server port (default: 587)
- `SMTP_USER` - SMTP username
- `SMTP_PASS` - SMTP password

**Admin API Endpoints:**
- `GET /api/admin/stats` - Get monitoring statistics, settings, and last sync timestamp
- `POST /api/admin/settings` - Update monitoring settings
- `POST /api/admin/run-monitoring` - Manually trigger monitoring cycle
- `GET /api/admin/numbers` - Get all numbers with usage counts
- `POST /api/admin/purchase-number` - Manually purchase a new number
- `POST /api/admin/sync-twilio` - Force immediate sync with Twilio

### Auto-Sync System
The application automatically synchronizes phone numbers from Twilio:

**How it works:**
- Every 5 minutes, the monitoring cycle syncs numbers from Twilio
- New numbers purchased on Twilio are automatically imported
- Numbers deleted from Twilio are automatically marked as invalid
- Last sync timestamp is displayed in the admin dashboard

**Manual Sync:**
- Click "Synchroniser maintenant" in the admin dashboard
- Or call `POST /api/admin/sync-twilio`

### Profitability Analysis
The admin dashboard includes a profitability table showing:

**Per-Number Metrics:**
- Cost per number: 1.05€ initial + 1.05€/month = 2.10€ total monthly cost
- Revenue potential for each pricing plan (Basique 2€, Standard 5€, Premium 9€)
- Profit margins (>99% for all plans)
- ROI calculations

**Per-User Metrics:**
- Cost per user based on usage threshold
- Profit per user for each plan
- Cost as percentage of price

**Break-Even Analysis:**
- Minimum uses needed per plan to cover costs
- Basique: 2 uses, Standard: 1 use, Premium: 1 use
