import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import { authStorage } from "./storage";
import * as telegram from "../../telegram-service";

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

async function upsertUser(claims: any) {
  const email = claims["email"] as string | undefined;
  const isNew = email ? !(await authStorage.getUserByEmail(email)) : false;
  const user = await authStorage.upsertUser({
    id: claims["sub"],
    email,
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
  if (isNew && email) {
    const name = [claims["first_name"], claims["last_name"]].filter(Boolean).join(" ") || null;
    telegram.notifyNewUser(email, name, "google").catch(() => {});
  }
  return user;
}

export function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(passport.initialize());

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    try {
      const claims = tokens.claims();
      const dbUser = await upsertUser(claims);
      verified(null, { dbUserId: dbUser.id });
    } catch (err) {
      verified(err as Error);
    }
  };

  const registeredStrategies = new Set<string>();

  const ensureStrategy = async (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const config = await getOidcConfig();
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: any, cb) => cb(null, user));
  passport.deserializeUser((user: any, cb) => cb(null, user));

  app.get("/api/login", async (req, res, next) => {
    try {
      const domain = req.hostname;
      await ensureStrategy(domain);
      passport.authenticate(`replitauth:${domain}`, {
        prompt: "login consent",
        scope: ["openid", "email", "profile", "offline_access"],
      })(req, res, next);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/callback", async (req, res, next) => {
    try {
      const domain = req.hostname;
      await ensureStrategy(domain);
      passport.authenticate(`replitauth:${domain}`, {
        session: false,
        failureRedirect: "/auth",
      })(req, res, (err: any) => {
        if (err) return next(err);
        const passportUser = req.user as any;
        if (passportUser?.dbUserId) {
          req.session.userId = passportUser.dbUserId;
          req.session.save(() => {
            res.redirect("/dashboard");
          });
        } else {
          res.redirect("/auth");
        }
      });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/logout", (req, res) => {
    req.session.destroy(() => {
      res.redirect("/");
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (req.session.userId) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};
