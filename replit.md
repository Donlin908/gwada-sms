# NuméroSMS - Virtual SMS Number Service

## Overview

NuméroSMS is a virtual phone number service that allows users to receive SMS verification codes using French or American phone numbers. The application provides temporary virtual numbers for receiving SMS messages without requiring users to respond - ideal for account verification purposes.

**Core Purpose:** Enable users to select virtual phone numbers (France or USA) and view incoming SMS messages in real-time for verification purposes.

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
- `GET /api/numbers?country={france|usa}` - List available phone numbers
- `GET /api/numbers/:id` - Get single phone number details
- `GET /api/messages/:phoneNumberId` - Get SMS messages for a number
- `POST /api/numbers/:id/reserve` - Reserve a phone number
- `GET /api/numbers/:id/check-usage` - Check if number was used before
- `POST /api/sync-twilio-numbers` - Sync numbers from Twilio
- `GET /api/twilio/status` - Check Twilio configuration status

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
3. Call `POST /api/sync-twilio-numbers` to sync them to the database
4. The numbers will automatically appear in the application

### Reservation System
- Users can reserve numbers for 24h, 7 days, or 30 days
- Reservations expire automatically
- Usage history prevents the same user from using the same number twice
- Numbers become available again after reservation expires
