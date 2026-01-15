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

### Backend Architecture
- **Runtime:** Node.js with Express.js
- **Language:** TypeScript with ESM modules
- **API Style:** REST endpoints under `/api/*` prefix
- **Build Process:** esbuild for server bundling, Vite for client

**API Endpoints:**
- `GET /api/numbers?country={france|usa}` - List available phone numbers
- `GET /api/numbers/:id` - Get single phone number details
- `GET /api/messages/:phoneNumberId` - Get SMS messages for a number

### Data Storage
- **ORM:** Drizzle ORM with PostgreSQL dialect
- **Schema Location:** `shared/schema.ts`
- **Current State:** In-memory storage implementation with mock data (database connection configured but using mock storage)
- **Database Config:** Drizzle Kit for migrations, expects `DATABASE_URL` environment variable

**Data Models:**
- `PhoneNumber` - Virtual phone numbers with country, availability status
- `SmsMessage` - Received SMS messages linked to phone numbers
- `User` - Basic user authentication (username/password)
- `PricingPlan` - Subscription tier definitions

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
  storage.ts      # Data access layer
  static.ts       # Static file serving
shared/           # Shared types and schemas
  schema.ts       # Drizzle schema + TypeScript types
```

### Development Workflow
- `npm run dev` - Start development server with hot reload
- `npm run build` - Production build (client + server)
- `npm run db:push` - Push schema changes to database

## External Dependencies

### Database
- **PostgreSQL** - Primary database (configured via `DATABASE_URL`)
- **Drizzle ORM** - Type-safe database operations
- **connect-pg-simple** - Session storage for PostgreSQL

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

### Potential Future Integrations
Based on bundled dependencies, the project is prepared for:
- **Stripe** - Payment processing for pricing plans
- **Passport** - Authentication middleware
- **Nodemailer** - Email notifications
- **OpenAI/Google Generative AI** - AI features