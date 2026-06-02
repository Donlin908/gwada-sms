import * as Sentry from "@sentry/node";

// Initialize Sentry BEFORE importing instrumented modules
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
    ],
  });
  console.log("[Sentry] Backend monitoring initialized");
} else {
  console.warn("[Sentry] Warning: SENTRY_DSN is not set. Error reporting is disabled.");
}

// Import instrumented modules after Sentry initialization
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync } from './stripeClient';
import { WebhookHandlers } from './webhookHandlers';
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import pg from "pg";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

declare module "express-session" {
  interface SessionData {
    userId?: string;
    adminAuth?: boolean;
  }
}

async function ensureSessionTable() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
      );
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    `);
  } catch (err) {
    console.error('Failed to ensure session table:', err);
  } finally {
    await client.end();
  }
}

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log('DATABASE_URL not set, skipping Stripe initialization');
    return;
  }

  // Skip heavy migrations in development — only run in production
  if (process.env.NODE_ENV !== 'production' && process.env.REPLIT_DEPLOYMENT !== '1') {
    console.log('[Stripe] Skipping schema migrations in dev mode');
    return;
  }

  try {
    console.log('Initializing Stripe schema...');
    await runMigrations({ databaseUrl });
    console.log('Stripe schema ready');
  } catch (error) {
    console.error('Failed to initialize Stripe schema:', error);
  }
}

async function setupTelegramWebhook() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const domain = process.env.REPLIT_DOMAINS?.split(',')[0];
  if (!token || !domain) return;
  try {
    const webhookUrl = `https://${domain}/api/telegram/webhook`;
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl }),
    });
    const data = await res.json() as any;
    if (data.ok) {
      console.log(`[Telegram] Webhook configuré : ${webhookUrl}`);
    } else {
      console.error("[Telegram] Erreur setWebhook:", data.description);
    }
  } catch (err: any) {
    console.error("[Telegram] Impossible de configurer le webhook:", err.message);
  }
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

async function main() {
  app.post(
    '/api/stripe/webhook',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      const signature = req.headers['stripe-signature'];

      if (!signature) {
        return res.status(400).json({ error: 'Missing stripe-signature' });
      }

      try {
        const sig = Array.isArray(signature) ? signature[0] : signature;

        if (!Buffer.isBuffer(req.body)) {
          console.error('STRIPE WEBHOOK ERROR: req.body is not a Buffer');
          return res.status(500).json({ error: 'Webhook processing error' });
        }

        await WebhookHandlers.processWebhook(req.body as Buffer, sig);
        res.status(200).json({ received: true });
      } catch (error: any) {
        console.error('Webhook error:', error.message);
        res.status(400).json({ error: 'Webhook processing error' });
      }
    }
  );

  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false }));

  const PgSession = connectPgSimple(session);
  app.use(
    session({
      store: new PgSession({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      },
    })
  );

  setupAuth(app);
  registerAuthRoutes(app);

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        log(logLine);
      }
    });

    next();
  });

  await registerRoutes(httpServer, app);

  if (process.env.SENTRY_DSN) {
    Sentry.setupExpressErrorHandler(app);
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    // Placeholder so GET / returns HTTP 200 immediately when port opens.
    // Vite will replace this handler once it finishes compiling.
    app.get("/", (_req, res, next) => {
      if ((app as any)._viteReady) return next();
      res.status(200).send("<!DOCTYPE html><html><head><meta http-equiv='refresh' content='2'><title>Démarrage…</title></head><body>Démarrage du serveur…</body></html>");
    });
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
    ensureSessionTable().catch(console.error);
    setupTelegramWebhook().catch(console.error);
    // Delay Stripe init so it doesn't block the event loop at startup
    setTimeout(() => {
      initStripe().catch((err) => console.error('Stripe init error:', err));
    }, 5000);
    // Set up Vite async — port is already open so workflow health-check passes
    if (process.env.NODE_ENV !== "production") {
      import("./vite").then(({ setupVite }) => {
        return setupVite(httpServer, app);
      }).then(() => {
        (app as any)._viteReady = true;
        log("Vite ready");
      }).catch((err) => {
        console.error("Vite setup error (non-fatal):", err?.message || err);
      });
    }
  });
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRASH] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[CRASH] Uncaught Exception:', err);
});


main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
