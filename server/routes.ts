import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { type Country, pricingPlans, phoneNumbers, reservations, users, insertReviewSchema } from "@shared/schema";
import * as twilioService from "./twilio-service";
import * as numberMonitor from "./number-monitor";
import { startMonthlyReminder } from "./monthly-reminder";
import { startBotScheduler, getStripeRevenueForPeriod } from "./bot-scheduler";
import { startSmsPoller } from "./sms-poller";
import { isEmailConfigured, sendVerificationEmail } from "./email-service";
import * as telegram from "./telegram-service";
import { z } from "zod";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { sql, eq } from "drizzle-orm";
import { db } from "./db";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import rateLimit from "express-rate-limit";

const adminSettingsSchema = z.object({
  usageAlertThreshold: z.number().int().min(1).max(10000).optional(),
  autoPurchaseEnabled: z.boolean().optional(),
  minNumbersPerCountry: z.number().int().min(1).max(100).optional(),
  maxNumbersPerCountry: z.number().int().min(1).max(100).optional(),
  adminEmail: z.string().email().optional(),
  maxUsagesDaily: z.number().int().min(1).max(1000).optional(),
  maxUsagesWeekly: z.number().int().min(1).max(1000).optional(),
  maxUsagesMonthly: z.number().int().min(1).max(1000).optional(),
  maintenanceMode: z.boolean().optional(),
});

const purchaseNumberSchema = z.object({
  country: z.enum(["france", "usa", "canada"]),
});

const adminLoginSchema = z.object({
  password: z.string().min(1),
});

const registerSchema = z.object({
  username: z.string().min(3, "Le nom d'utilisateur doit faire au moins 3 caractères"),
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Le mot de passe doit faire au moins 6 caractères"),
});

const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ─── Rate Limiters ───────────────────────────────────────────────────────
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // max 10 tentatives par IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Trop de tentatives, réessayez dans 15 minutes." },
    skipSuccessfulRequests: true, // Ne compte pas les succès
  });

  const adminLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5, // max 5 tentatives pour l'admin
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Trop de tentatives admin, réessayez dans 15 minutes." },
    skipSuccessfulRequests: true,
  });

  const paymentLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Trop de requêtes de paiement." },
  });

  app.use("/api/auth/register", authLimiter);
  app.use("/api/auth/login", authLimiter);
  app.use("/api/admin/login", adminLoginLimiter);
  app.use("/api/stripe/create-checkout-session", paymentLimiter);
  // ─────────────────────────────────────────────────────────────────────────

  app.post("/api/auth/register", async (req, res) => {
    try {
      const parseResult = registerSchema.safeParse(req.body);
      if (!parseResult.success) {
        const firstError = parseResult.error.errors[0]?.message || "Données invalides";
        return res.status(400).json({ error: firstError });
      }

      const { username, email, password } = parseResult.data;

      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(409).json({ error: "Cet email est déjà utilisé" });
      }

      const existingUsername = await storage.getUserByUsername(username);
      if (existingUsername) {
        return res.status(409).json({ error: "Ce nom d'utilisateur est déjà pris" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const verificationToken = crypto.randomBytes(32).toString("hex");
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const user = await storage.createUser({
        username,
        email,
        password: hashedPassword,
      });

      await storage.updateUserVerification(user.id, {
        verificationToken,
        verificationExpires,
      });

      const emailSent = await sendVerificationEmail(email, verificationToken);
      telegram.notifyNewUser(email, username ?? null, "local").catch(() => {});

      req.session.regenerate((err) => {
        if (err) {
          console.error("Session regeneration error:", err);
          return res.status(500).json({ error: "Erreur serveur" });
        }
        req.session.userId = user.id;
        req.session.save((err) => {
          if (err) {
            console.error("Session save error:", err);
            return res.status(500).json({ error: "Erreur serveur" });
          }
          res.json({
            user: { id: user.id, username: user.username, email: user.email, emailVerified: false },
            requiresVerification: true,
            emailSent,
          });
        });
      });
    } catch (error) {
      console.error("Error during registration:", error);
      res.status(500).json({ error: "Erreur lors de l'inscription" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const parseResult = loginSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Données invalides" });
      }

      const { email, password } = parseResult.data;

      const user = await storage.getUserByEmail(email);
      if (!user || !user.password) {
        return res.status(401).json({ error: "Email ou mot de passe incorrect" });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: "Email ou mot de passe incorrect" });
      }

      req.session.regenerate((err) => {
        if (err) {
          console.error("Session regeneration error:", err);
          return res.status(500).json({ error: "Erreur serveur" });
        }
        req.session.userId = user.id;
        req.session.save((err) => {
          if (err) {
            console.error("Session save error:", err);
            return res.status(500).json({ error: "Erreur serveur" });
          }
          res.json({
            user: { id: user.id, username: user.username, email: user.email, emailVerified: user.emailVerified },
          });
        });
      });
    } catch (error) {
      console.error("Error during login:", error);
      res.status(500).json({ error: "Erreur de connexion" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        req.session.destroy(() => {});
        return res.status(401).json({ error: "Utilisateur non trouvé" });
      }

      const displayName = user.username || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email.split("@")[0];

      res.json({
        user: {
          id: user.id,
          username: displayName,
          email: user.email,
          emailVerified: user.emailVerified,
          authProvider: user.authProvider,
          profileImageUrl: user.profileImageUrl,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/auth/verify-email", async (req, res) => {
    try {
      const token = req.query.token as string;
      if (!token) {
        return res.status(400).json({ error: "Token manquant" });
      }

      const user = await storage.getUserByVerificationToken(token);
      if (!user) {
        return res.status(400).json({ error: "Token invalide ou expiré" });
      }

      if (user.verificationExpires && user.verificationExpires < new Date()) {
        return res.status(400).json({ error: "Ce lien a expiré. Demandez un nouveau lien de vérification." });
      }

      await storage.updateUserVerification(user.id, {
        emailVerified: true,
        verificationToken: null,
        verificationExpires: null,
      });

      res.json({ message: "Email vérifié avec succès !" });
    } catch (error) {
      console.error("Error verifying email:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/auth/resend-verification", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }

      if (user.emailVerified) {
        return res.json({ message: "Email déjà vérifié" });
      }

      const verificationToken = crypto.randomBytes(32).toString("hex");
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await storage.updateUserVerification(user.id, {
        verificationToken,
        verificationExpires,
      });

      const sent = await sendVerificationEmail(user.email, verificationToken);
      if (!sent) {
        return res.status(500).json({ error: "Impossible d'envoyer l'email. Vérifiez la configuration SMTP." });
      }

      res.json({ message: "Email de vérification renvoyé" });
    } catch (error) {
      console.error("Error resending verification:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Erreur lors de la déconnexion" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Déconnexion réussie" });
    });
  });

  app.get("/api/user/reservations", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const userReservations = await storage.getReservationsByUserId(req.session.userId);

      const enriched = await Promise.all(
        userReservations.map(async (r) => {
          const phone = await storage.getPhoneNumber(r.phoneNumberId);
          const plan = pricingPlans.find((p) => p.id === r.planId);
          return {
            id: r.id,
            phoneNumberId: r.phoneNumberId,
            phoneNumber: phone?.number || "Inconnu",
            country: phone?.country || "unknown",
            planName: plan?.name || r.planId,
            planDuration: plan?.duration || "",
            startsAt: r.startsAt.toISOString(),
            expiresAt: r.expiresAt.toISOString(),
            isActive: r.isActive && new Date(r.expiresAt) > new Date(),
          };
        })
      );

      res.json(enriched);
    } catch (error) {
      console.error("Error fetching user reservations:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/numbers", async (req, res) => {
    try {
      const country = (req.query.country as Country) || "france";
      if (country !== "france" && country !== "usa" && country !== "canada") {
        return res.status(400).json({ error: "Invalid country. Use 'france', 'usa' or 'canada'." });
      }
      
      await storage.expireOldReservations();
      
      const [numbers, maxDailyStr, maxWeeklyStr, maxMonthlyStr] = await Promise.all([
        storage.getPhoneNumbers(country),
        storage.getSetting("max_usages_daily"),
        storage.getSetting("max_usages_weekly"),
        storage.getSetting("max_usages_monthly"),
      ]);

      const maxUsageDaily = parseInt(maxDailyStr || "20");
      const maxUsageWeekly = parseInt(maxWeeklyStr || "10");
      const maxUsageMonthly = parseInt(maxMonthlyStr || "5");

      const formattedNumbers = numbers.map(num => {
        const twilioActive = num.isValid;
        const availabilityByPlan = {
          daily: num.isAvailable && twilioActive && num.usageCount < maxUsageDaily,
          weekly: num.isAvailable && twilioActive && num.usageCount < maxUsageWeekly,
          monthly: num.isAvailable && twilioActive && num.usageCount < maxUsageMonthly,
        };
        return {
          id: num.id,
          number: num.number,
          country: num.country,
          isAvailable: num.isAvailable,
          isValid: num.isValid,
          twilioActive,
          usageCount: num.usageCount,
          maxUsageDaily,
          maxUsageWeekly,
          maxUsageMonthly,
          availabilityByPlan,
          lastActive: num.lastValidatedAt?.toISOString() || new Date().toISOString(),
          lastTwilioCheck: num.lastTwilioCheck?.toISOString() || null,
        };
      });
      
      res.json(formattedNumbers);

      // Background: check Twilio for numbers not verified recently (> 60 min)
      setImmediate(async () => {
        try {
          const stale = await storage.getPhoneNumbersNeedingTwilioCheck(60);
          for (const num of stale.slice(0, 5)) {
            const active = await twilioService.checkNumberActiveInTwilio(num.twilioSid);
            await storage.updatePhoneNumber(num.id, {
              lastTwilioCheck: new Date(),
              isValid: active,
              ...(active ? {} : { lastValidatedAt: new Date() }),
            });
            if (!active) {
              console.log(`Number ${num.number} no longer active in Twilio — marked invalid`);
            }
          }
        } catch (e) {
          // silent — don't crash the response
        }
      });
    } catch (error) {
      console.error("Error fetching phone numbers:", error);
      res.status(500).json({ error: "Failed to fetch phone numbers" });
    }
  });

  app.get("/api/numbers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const phoneNumber = await storage.getPhoneNumber(id);
      if (!phoneNumber) {
        return res.status(404).json({ error: "Phone number not found" });
      }
      
      const reservation = await storage.getActiveReservation(id);
      
      res.json({
        id: phoneNumber.id,
        number: phoneNumber.number,
        country: phoneNumber.country,
        isAvailable: phoneNumber.isAvailable && !reservation,
        isValid: phoneNumber.isValid,
        lastActive: phoneNumber.lastValidatedAt?.toISOString() || new Date().toISOString(),
        hasActiveReservation: !!reservation,
      });
    } catch (error) {
      console.error("Error fetching phone number:", error);
      res.status(500).json({ error: "Failed to fetch phone number" });
    }
  });

  app.get("/api/messages/:phoneNumberId", async (req, res) => {
    try {
      const { phoneNumberId } = req.params;
      const phoneNumber = await storage.getPhoneNumber(phoneNumberId);
      if (!phoneNumber) {
        return res.status(404).json({ error: "Phone number not found" });
      }
      
      if (twilioService.isConfigured()) {
        const twilioMessages = await twilioService.getMessagesForNumber(phoneNumber.number);
        
        for (const msg of twilioMessages) {
          const existing = await storage.getMessageByTwilioSid(msg.sid);
          if (!existing) {
            await storage.createMessage({
              phoneNumberId: phoneNumber.id,
              twilioMessageSid: msg.sid,
              sender: msg.from,
              content: msg.body,
              receivedAt: msg.dateSent,
            });
            // Alerte Telegram pour chaque nouveau SMS reçu
            const [resData] = await db.execute(sql`
              SELECT u.email, r.telegram_chat_id
              FROM reservations r
              JOIN users u ON r.user_id = u.id
              WHERE r.phone_number_id = ${phoneNumber.id} AND r.expires_at > NOW()
              LIMIT 1
            `);
            const userEmail = (resData as any)?.email;
            const userChatId = (resData as any)?.telegram_chat_id;

            // Notification Admin
            telegram.notifySmsReceived(phoneNumber.number, msg.from, msg.body, phoneNumber.country, userEmail).catch(() => {});

            // Notification Client (si activée)
            if (userChatId) {
              const flag = phoneNumber.country === "france" ? "🇫🇷" : phoneNumber.country === "canada" ? "🇨🇦" : "🇺🇸";
              const text = `📩 <b>Nouveau SMS reçu</b>\n` +
                `Sur votre numéro : ${flag} <code>${phoneNumber.number}</code>\n` +
                `De : <code>${msg.from}</code>\n` +
                `Message : <code>${msg.body}</code>\n` +
                `📅 ${new Date().toLocaleString("fr-FR")}`;
              
              fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: userChatId,
                  text,
                  parse_mode: "HTML",
                }),
              }).catch(err => console.error("[Telegram Client] Erreur:", err.message));
            }
          }
        }
      }
      
      const messages = await storage.getMessages(phoneNumberId);
      
      const formattedMessages = messages.map(msg => ({
        id: msg.id,
        phoneNumberId: msg.phoneNumberId,
        sender: msg.sender,
        content: msg.content,
        receivedAt: msg.receivedAt.toISOString(),
      }));
      
      res.json(formattedMessages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/numbers/:id/reserve", async (req, res) => {
    try {
      const { id } = req.params;
      const { planId, sessionId } = req.body;
      
      if (!planId || !sessionId) {
        return res.status(400).json({ error: "Plan ID and session ID are required" });
      }
      
      const plan = pricingPlans.find(p => p.id === planId);
      if (!plan) {
        return res.status(400).json({ error: "Invalid plan ID" });
      }
      
      const phoneNumber = await storage.getPhoneNumber(id);
      if (!phoneNumber) {
        return res.status(404).json({ error: "Phone number not found" });
      }
      
      const existingReservation = await storage.getActiveReservation(id);
      if (existingReservation) {
        return res.status(409).json({ error: "Phone number is already reserved" });
      }
      
      const hasUsed = await storage.hasBeenUsedBySession(id, sessionId);
      if (hasUsed) {
        return res.status(409).json({ error: "You have already used this number before" });
      }

      // Check per-plan usage limits
      const settingKey = planId === "daily" ? "max_usages_daily" : planId === "weekly" ? "max_usages_weekly" : "max_usages_monthly";
      const defaultLimit = planId === "daily" ? "20" : planId === "weekly" ? "10" : "5";
      const maxUsageStr = await storage.getSetting(settingKey) || defaultLimit;
      const maxUsage = parseInt(maxUsageStr);
      if (phoneNumber.usageCount >= maxUsage) {
        return res.status(409).json({ error: `Ce numéro a atteint la limite d'utilisation pour le plan ${plan.name} (${maxUsage} fois)` });
      }

      // Check Twilio validity
      if (!phoneNumber.isValid) {
        return res.status(409).json({ error: "Ce numéro n'est plus actif chez notre fournisseur" });
      }
      
      const now = new Date();
      const expiresAt = new Date(now.getTime() + plan.durationHours * 60 * 60 * 1000);
      
      const reservation = await storage.createReservation({
        phoneNumberId: id,
        planId,
        sessionId,
        startsAt: now,
        expiresAt,
        isActive: true,
      });
      
      await storage.recordUsage({
        phoneNumberId: id,
        sessionId,
        usedAt: now,
        purpose: `Reserved with ${plan.name} plan`,
      });
      
      res.json({
        reservation: {
          id: reservation.id,
          phoneNumberId: reservation.phoneNumberId,
          planId: reservation.planId,
          startsAt: reservation.startsAt.toISOString(),
          expiresAt: reservation.expiresAt.toISOString(),
        },
        message: `Number reserved until ${expiresAt.toLocaleString()}`,
      });
    } catch (error) {
      console.error("Error reserving phone number:", error);
      res.status(500).json({ error: "Failed to reserve phone number" });
    }
  });

  app.get("/api/numbers/:id/check-usage", async (req, res) => {
    try {
      const { id } = req.params;
      const sessionId = req.query.sessionId as string;
      
      if (!sessionId) {
        return res.status(400).json({ error: "Session ID is required" });
      }
      
      const hasUsed = await storage.hasBeenUsedBySession(id, sessionId);
      const usageHistory = await storage.getUsageHistory(id);
      
      res.json({
        hasBeenUsedByYou: hasUsed,
        totalUsageCount: usageHistory.length,
      });
    } catch (error) {
      console.error("Error checking usage:", error);
      res.status(500).json({ error: "Failed to check usage" });
    }
  });

  app.post("/api/sync-twilio-numbers", async (req, res) => {
    try {
      if (!twilioService.isConfigured()) {
        return res.status(503).json({ error: "Twilio is not configured" });
      }
      
      const twilioNumbers = await twilioService.getAllTwilioNumbers();
      let synced = 0;
      
      for (const twilioNum of twilioNumbers) {
        const existing = await storage.getPhoneNumberByTwilioSid(twilioNum.sid);
        if (!existing) {
          let country: Country = "usa";
          if (twilioNum.phoneNumber.startsWith("+33")) {
            country = "france";
          }
          
          await storage.createPhoneNumber({
            twilioSid: twilioNum.sid,
            number: twilioNum.phoneNumber,
            country,
            isAvailable: true,
            isValid: twilioNum.capabilities.sms,
            lastValidatedAt: new Date(),
          });
          synced++;
        }
      }
      
      res.json({ 
        message: `Synced ${synced} new numbers from Twilio`,
        totalTwilioNumbers: twilioNumbers.length,
      });
    } catch (error) {
      console.error("Error syncing Twilio numbers:", error);
      res.status(500).json({ error: "Failed to sync Twilio numbers" });
    }
  });

  // Statut public du service (maintenance, etc.)
  app.get("/api/status", async (req, res) => {
    try {
      const maintenanceMode = await storage.getSetting("maintenance_mode");
      res.json({
        maintenance: maintenanceMode === "true",
        version: "1.0.0",
      });
    } catch {
      res.json({ maintenance: false, version: "1.0.0" });
    }
  });

  app.get("/api/reviews", async (req, res) => {
    try {
      const allReviews = await storage.getReviews();
      res.json(allReviews);
    } catch {
      res.status(500).json({ error: "Erreur lors de la récupération des avis" });
    }
  });

  app.post("/api/reviews", async (req, res) => {
    try {
      const parsed = insertReviewSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Données invalides" });
      }
      const review = await storage.createReview(parsed.data);
      res.status(201).json(review);
    } catch {
      res.status(500).json({ error: "Erreur lors de la création de l'avis" });
    }
  });

  app.delete("/api/admin/reviews/:id", async (req, res) => {
    try {
      await storage.deleteReview(req.params.id);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Erreur lors de la suppression de l'avis" });
    }
  });

  app.get("/api/twilio/status", async (req, res) => {
    try {
      const isConfigured = twilioService.isConfigured();
      
      if (isConfigured) {
        const numbers = await twilioService.getAllTwilioNumbers();
        res.json({
          configured: true,
          numbersAvailable: numbers.length,
          message: `Twilio is configured with ${numbers.length} numbers`,
        });
      } else {
        res.json({
          configured: false,
          numbersAvailable: 0,
          message: "Twilio is not configured. Using demo mode.",
        });
      }
    } catch (error) {
      console.error("Error checking Twilio status:", error);
      res.json({
        configured: false,
        numbersAvailable: 0,
        message: "Error connecting to Twilio",
      });
    }
  });

  app.get("/api/admin/twilio-diag", async (req, res) => {
    try {
      const diag = await twilioService.getTwilioDiagnostics();
      res.json(diag);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/admin/login", async (req, res) => {
    try {
      const parseResult = adminLoginSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Mot de passe requis" });
      }
      
      const { password } = parseResult.data;
      const adminPassword = process.env.ADMIN_PASSWORD;
      
      if (!adminPassword) {
        return res.status(503).json({ error: "Mot de passe admin non configuré" });
      }
      
      if (password === adminPassword) {
        req.session.adminAuth = true;
        res.json({ success: true, message: "Connexion réussie" });
      } else {
        res.status(401).json({ error: "Mot de passe incorrect" });
      }
    } catch (error) {
      console.error("Error during admin login:", error);
      res.status(500).json({ error: "Erreur de connexion" });
    }
  });

  app.get("/api/admin/stats", async (req, res) => {
    try {
      const stats = await numberMonitor.getMonitoringStats();
      const emailConfigured = isEmailConfigured();
      const twilioConfigured = twilioService.isConfigured();
      
      const usageThreshold = await storage.getSetting("usage_alert_threshold") || "100";
      const autoPurchaseEnabled = await storage.getSetting("auto_purchase_enabled") || "false";
      const minPerCountry = await storage.getSetting("min_numbers_per_country") || "3";
      const maxPerCountry = await storage.getSetting("max_numbers_per_country") || "10";
      const maxUsagesDaily = await storage.getSetting("max_usages_daily") || "20";
      const maxUsagesWeekly = await storage.getSetting("max_usages_weekly") || "10";
      const maxUsagesMonthly = await storage.getSetting("max_usages_monthly") || "5";
      const franceBundleRequired = await storage.getSetting("france_bundle_required") || "false";
      const maintenanceMode = await storage.getSetting("maintenance_mode") || "false";
      
      res.json({
        ...stats,
        settings: {
          usageAlertThreshold: parseInt(usageThreshold),
          autoPurchaseEnabled: autoPurchaseEnabled === "true",
          minNumbersPerCountry: parseInt(minPerCountry),
          maxNumbersPerCountry: parseInt(maxPerCountry),
          maxUsagesDaily: parseInt(maxUsagesDaily),
          maxUsagesWeekly: parseInt(maxUsagesWeekly),
          maxUsagesMonthly: parseInt(maxUsagesMonthly),
          franceBundleRequired: franceBundleRequired === "true",
          maintenanceMode: maintenanceMode === "true",
        },
        services: {
          emailConfigured,
          twilioConfigured,
        },
      });
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ error: "Failed to fetch admin stats" });
    }
  });

  app.post("/api/admin/settings", async (req, res) => {
    try {
      const parseResult = adminSettingsSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Invalid settings data", 
          details: parseResult.error.errors 
        });
      }
      
      const { usageAlertThreshold, autoPurchaseEnabled, minNumbersPerCountry, maxNumbersPerCountry, adminEmail, maxUsagesDaily, maxUsagesWeekly, maxUsagesMonthly, maintenanceMode } = parseResult.data;
      
      if (usageAlertThreshold !== undefined) {
        await storage.setSetting("usage_alert_threshold", String(usageAlertThreshold));
      }
      if (autoPurchaseEnabled !== undefined) {
        await storage.setSetting("auto_purchase_enabled", String(autoPurchaseEnabled));
      }
      if (minNumbersPerCountry !== undefined) {
        await storage.setSetting("min_numbers_per_country", String(minNumbersPerCountry));
      }
      if (maxNumbersPerCountry !== undefined) {
        await storage.setSetting("max_numbers_per_country", String(maxNumbersPerCountry));
      }
      if (adminEmail !== undefined) {
        await storage.setSetting("admin_email", adminEmail);
      }
      if (maxUsagesDaily !== undefined) {
        await storage.setSetting("max_usages_daily", String(maxUsagesDaily));
      }
      if (maxUsagesWeekly !== undefined) {
        await storage.setSetting("max_usages_weekly", String(maxUsagesWeekly));
      }
      if (maxUsagesMonthly !== undefined) {
        await storage.setSetting("max_usages_monthly", String(maxUsagesMonthly));
      }
      if (maintenanceMode !== undefined) {
        await storage.setSetting("maintenance_mode", String(maintenanceMode));
      }
      
      res.json({ message: "Settings updated successfully" });
    } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  app.post("/api/admin/run-monitoring", async (req, res) => {
    try {
      const stats = await numberMonitor.runMonitoringCycle();
      res.json({
        message: "Monitoring cycle completed",
        stats,
      });
    } catch (error) {
      console.error("Error running monitoring:", error);
      res.status(500).json({ error: "Failed to run monitoring" });
    }
  });

  app.get("/api/admin/numbers", async (req, res) => {
    try {
      const [numbers, maxDailyStr, maxWeeklyStr, maxMonthlyStr] = await Promise.all([
        storage.getAllPhoneNumbers(),
        storage.getSetting("max_usages_daily"),
        storage.getSetting("max_usages_weekly"),
        storage.getSetting("max_usages_monthly"),
      ]);
      const maxUsageDaily = parseInt(maxDailyStr || "20");
      const maxUsageWeekly = parseInt(maxWeeklyStr || "10");
      const maxUsageMonthly = parseInt(maxMonthlyStr || "5");
      res.json(numbers.map(n => ({
        id: n.id,
        number: n.number,
        country: n.country,
        usageCount: n.usageCount,
        isAvailable: n.isAvailable,
        isValid: n.isValid,
        twilioActive: n.isValid,
        lastTwilioCheck: n.lastTwilioCheck?.toISOString() || null,
        maxUsageDaily,
        maxUsageWeekly,
        maxUsageMonthly,
        availabilityByPlan: {
          daily: n.isAvailable && n.isValid && n.usageCount < maxUsageDaily,
          weekly: n.isAvailable && n.isValid && n.usageCount < maxUsageWeekly,
          monthly: n.isAvailable && n.isValid && n.usageCount < maxUsageMonthly,
        },
        createdAt: n.createdAt.toISOString(),
      })));
    } catch (error) {
      console.error("Error fetching all numbers:", error);
      res.status(500).json({ error: "Failed to fetch numbers" });
    }
  });

  app.post("/api/admin/purchase-number", async (req, res) => {
    try {
      if (!twilioService.isConfigured()) {
        return res.status(503).json({ error: "Twilio is not configured" });
      }
      
      const parseResult = purchaseNumberSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid country. Use 'france' or 'usa'." });
      }
      
      const { country } = parseResult.data;
      
      const countryCode = country === "france" ? "FR" : country === "canada" ? "CA" : "US";
      const available = await twilioService.searchAvailableNumbers(countryCode, 5);
      const smsCandidate = available.find(n => n.smsCapable);

      if (!smsCandidate) {
        if (country === "france") {
          return res.status(404).json({
            error: "Aucun numéro Mobile France compatible SMS n'est disponible chez Twilio actuellement. Les numéros Mobile français sont souvent en rupture de stock — réessayez plus tard.",
          });
        }
        return res.status(404).json({ error: "Aucun numéro compatible SMS disponible dans cette région" });
      }
      
      let purchased;
      try {
        purchased = await twilioService.purchasePhoneNumber(smsCandidate.phoneNumber, undefined, smsCandidate.smsCapable);
      } catch (purchaseErr: any) {
        return res.status(400).json({ error: purchaseErr?.userMessage || "Échec de l'achat du numéro auprès de Twilio." });
      }
      if (!purchased) {
        return res.status(500).json({ error: "Le numéro trouvé n'est pas compatible SMS. Aucun numéro SMS disponible dans cette région." });
      }
      
      const phoneNumber = await storage.createPhoneNumber({
        twilioSid: purchased.sid,
        number: purchased.phoneNumber,
        country: country as Country,
        isAvailable: true,
        isValid: true,
      });
      
      res.json({
        message: "Number purchased successfully",
        phoneNumber: {
          id: phoneNumber.id,
          number: phoneNumber.number,
          country: phoneNumber.country,
        },
      });
    } catch (error) {
      console.error("Error purchasing number:", error);
      res.status(500).json({ error: "Failed to purchase number" });
    }
  });

  app.post("/api/admin/sync-twilio", async (req, res) => {
    try {
      if (!twilioService.isConfigured()) {
        return res.status(503).json({ error: "Twilio is not configured" });
      }
      
      const result = await numberMonitor.syncTwilioNumbers();
      
      res.json({
        message: "Sync completed",
        synced: result.synced,
        invalidated: result.invalidated,
      });
    } catch (error) {
      console.error("Error syncing Twilio numbers:", error);
      res.status(500).json({ error: "Failed to sync numbers" });
    }
  });

  app.get("/api/admin/users", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT id, username, email, first_name, last_name, email_verified, auth_provider, created_at
        FROM users
        ORDER BY created_at DESC
      `);
      res.json({ users: result.rows });
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/admin/telegram/status", async (req, res) => {
    res.json({
      configured: telegram.isConfigured(),
      botToken: process.env.TELEGRAM_BOT_TOKEN ? "***" + process.env.TELEGRAM_BOT_TOKEN.slice(-4) : null,
      chatId: process.env.TELEGRAM_CHAT_ID || null,
    });
  });

  app.post("/api/admin/telegram/test", async (req, res) => {
    const ok = await telegram.testConnection();
    if (ok) {
      res.json({ success: true, message: "Message de test envoyé sur Telegram ✅" });
    } else {
      res.status(500).json({ success: false, message: "Échec — vérifiez TELEGRAM_BOT_TOKEN et TELEGRAM_CHAT_ID" });
    }
  });

  app.post("/api/admin/telegram/daily-report", async (req, res) => {
    try {
      const allNumbers = await storage.getPhoneNumbers();
      const validFrance = allNumbers.filter((n: any) => n.country === "france" && n.isValid).length;
      const validUsa = allNumbers.filter((n: any) => n.country === "usa" && n.isValid).length;
      const totalValid = validFrance + validUsa;

      const usersRes = await db.execute(sql`SELECT COUNT(*) AS total FROM users`);
      const reservRes = await db.execute(sql`SELECT COUNT(*) AS total FROM reservations WHERE expires_at > NOW()`);
      const totalUsers = parseInt(String((usersRes.rows?.[0] as any)?.total ?? (usersRes as any)[0]?.total ?? "0"), 10);
      const totalReservations = parseInt(String((reservRes.rows?.[0] as any)?.total ?? (reservRes as any)[0]?.total ?? "0"), 10);

      await telegram.sendDailyReport({
        totalNumbers: totalValid,
        franceNumbers: validFrance,
        usaNumbers: validUsa,
        totalUsers,
        totalReservations,
        revenueToday: 0,
      });
      res.json({ success: true, message: "Rapport journalier envoyé sur Telegram ✅" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ─── Admin free reservations ─────────────────────────────────────────────

  const adminReserveSchema = z.object({
    phoneNumberId: z.string().min(1),
    planId: z.enum(["daily", "weekly", "monthly"]),
  });

  app.post("/api/admin/reserve-number", async (req, res) => {
    if (!req.session?.adminAuth) return res.status(401).json({ error: "Non autorisé" });
    try {
      const parsed = adminReserveSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "phoneNumberId et planId (daily/weekly/monthly) sont requis" });
      }
      const { phoneNumberId, planId } = parsed.data;

      const plan = pricingPlans.find(p => p.id === planId);
      if (!plan) return res.status(400).json({ error: "Plan invalide" });

      const phoneNumber = await storage.getPhoneNumber(phoneNumberId);
      if (!phoneNumber) return res.status(404).json({ error: "Numéro introuvable" });
      if (!phoneNumber.isAvailable) return res.status(409).json({ error: "Ce numéro est déjà réservé" });
      if (!phoneNumber.isValid) return res.status(409).json({ error: "Ce numéro n'est plus actif chez Twilio" });

      const settingKey = planId === "daily" ? "max_usages_daily" : planId === "weekly" ? "max_usages_weekly" : "max_usages_monthly";
      const defaultLimit = planId === "daily" ? "20" : planId === "weekly" ? "10" : "5";
      const maxUsageStr = await storage.getSetting(settingKey) || defaultLimit;
      const maxUsage = parseInt(maxUsageStr);
      if (phoneNumber.usageCount >= maxUsage) {
        return res.status(409).json({ error: `Ce numéro a atteint la limite d'utilisation pour le plan ${plan.name} (${maxUsage} fois)` });
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + plan.durationHours * 60 * 60 * 1000);

      const reservation = await storage.createReservation({
        phoneNumberId,
        planId,
        userId: null,
        sessionId: "admin",
        startsAt: now,
        expiresAt,
        isActive: true,
      });

      await db.update(phoneNumbers).set({ isAvailable: false }).where(eq(phoneNumbers.id, phoneNumberId));

      await storage.recordUsage({
        phoneNumberId,
        sessionId: "admin",
        usedAt: now,
        purpose: `Admin reservation with ${plan.name} plan`,
      });

      res.json({
        id: reservation.id,
        phoneNumber: phoneNumber.number,
        country: phoneNumber.country,
        planId,
        expiresAt: expiresAt.toISOString(),
      });
    } catch (err: any) {
      console.error("[Admin] Erreur création réservation admin:", err.message);
      res.status(500).json({ error: "Erreur lors de la création de la réservation" });
    }
  });

  app.get("/api/admin/my-reservations", async (req, res) => {
    if (!req.session?.adminAuth) return res.status(401).json({ error: "Non autorisé" });
    try {
      const rows = await db
        .select({
          id: reservations.id,
          planId: reservations.planId,
          startsAt: reservations.startsAt,
          expiresAt: reservations.expiresAt,
          isActive: reservations.isActive,
          telegramToken: reservations.telegramToken,
          telegramChatId: reservations.telegramChatId,
          phoneNumberId: reservations.phoneNumberId,
          number: phoneNumbers.number,
          country: phoneNumbers.country,
        })
        .from(reservations)
        .leftJoin(phoneNumbers, eq(reservations.phoneNumberId, phoneNumbers.id))
        .where(eq(reservations.sessionId, "admin"));

      const botUsername = "GwadasmsBot";
      const result = rows
        .filter(r => r.isActive && r.expiresAt > new Date())
        .map(r => ({
          id: r.id,
          planId: r.planId,
          startsAt: r.startsAt.toISOString(),
          expiresAt: r.expiresAt.toISOString(),
          phoneNumberId: r.phoneNumberId,
          number: r.number,
          country: r.country,
          telegramConnected: !!r.telegramChatId,
          telegramLink: r.telegramToken
            ? `https://t.me/${botUsername}?start=${r.telegramToken}`
            : null,
        }));

      res.json(result);
    } catch (err: any) {
      console.error("[Admin] Erreur lecture réservations admin:", err.message);
      res.status(500).json({ error: "Erreur lors de la récupération des réservations" });
    }
  });

  app.delete("/api/admin/reservations/:id/release", async (req, res) => {
    if (!req.session?.adminAuth) return res.status(401).json({ error: "Non autorisé" });
    try {
      const { id } = req.params;
      const [reservation] = await db
        .select()
        .from(reservations)
        .where(eq(reservations.id, id))
        .limit(1);

      if (!reservation || reservation.sessionId !== "admin") {
        return res.status(404).json({ error: "Réservation admin introuvable" });
      }

      await db.update(reservations).set({ isActive: false }).where(eq(reservations.id, id));
      await db.update(phoneNumbers).set({ isAvailable: true }).where(eq(phoneNumbers.id, reservation.phoneNumberId));

      res.json({ success: true });
    } catch (err: any) {
      console.error("[Admin] Erreur libération réservation admin:", err.message);
      res.status(500).json({ error: "Erreur lors de la libération" });
    }
  });

  app.get("/api/admin/reservations/:id/telegram-link", async (req, res) => {
    if (!req.session?.adminAuth) return res.status(401).json({ error: "Non autorisé" });
    try {
      const { id } = req.params;
      const [reservation] = await db
        .select()
        .from(reservations)
        .where(eq(reservations.id, id))
        .limit(1);

      if (!reservation || reservation.sessionId !== "admin") {
        return res.status(404).json({ error: "Réservation admin introuvable" });
      }

      let token = reservation.telegramToken;
      if (!token) {
        token = crypto.randomBytes(16).toString("hex");
        await db.update(reservations).set({ telegramToken: token }).where(eq(reservations.id, id));
      }

      const botUsername = "GwadasmsBot";
      const deepLink = `https://t.me/${botUsername}?start=${token}`;

      const [pn] = await db
        .select({ number: phoneNumbers.number, country: phoneNumbers.country })
        .from(phoneNumbers)
        .where(eq(phoneNumbers.id, reservation.phoneNumberId))
        .limit(1);

      let sentToTelegram = false;
      const adminChatId = process.env.TELEGRAM_CHAT_ID;
      if (adminChatId && telegram.isConfigured()) {
        const flag = pn?.country === "france" ? "🇫🇷" : "🇺🇸";
        const message =
          `🔗 <b>Connecter votre numéro admin à Telegram</b>\n\n` +
          `${flag} <code>${pn?.number ?? ""}</code>\n` +
          `Expire le ${reservation.expiresAt.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}\n\n` +
          `Cliquez sur le lien ci-dessous pour activer la réception des SMS dans Telegram :\n${deepLink}`;
        try {
          await telegram.sendMessage(adminChatId, message);
          sentToTelegram = true;
        } catch (e: any) {
          console.error("[Admin] Échec envoi lien Telegram:", e.message);
        }
      }

      res.json({ deepLink, token, connected: !!reservation.telegramChatId, sentToTelegram });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Génère un lien Telegram pour une réservation (deep link avec token unique)
  app.get("/api/reservations/:id/telegram-link", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Non authentifié");
    try {
      const { id } = req.params;
      const [reservation] = await db.select().from(reservations).where(eq(reservations.id, id));
      if (!reservation || reservation.userId !== (req.user as any).id) {
        return res.status(404).send("Réservation non trouvée");
      }

      // Génère un token unique si pas encore fait
      let token = reservation.telegramToken;
      if (!token) {
        const { randomBytes } = await import("crypto");
        token = randomBytes(16).toString("hex");
        await db.update(reservations).set({ telegramToken: token }).where(eq(reservations.id, id));
      }

      const botUsername = "GwadasmsBot";
      const deepLink = `https://t.me/${botUsername}?start=${token}`;
      const connected = !!reservation.telegramChatId;

      res.json({ deepLink, token, connected });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Telegram Bot Purchase Session State ────────────────────────────────
  type TgSession = { step: string; country?: string; phoneNumberId?: string };
  const tgSessions = new Map<string, TgSession>();

  async function tgSend(chatId: string, text: string, extra: Record<string, any> = {}) {
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true, ...extra }),
    });
  }

  async function tgAnswer(callbackQueryId: string, text?: string) {
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text: text || "" }),
    });
  }

  // Webhook Telegram — reçoit les mises à jour du bot
  app.post("/api/telegram/webhook", async (req, res) => {
    try {
      const update = req.body;

      // ── Callback query (bouton inline pressé) ─────────────────────────
      if (update?.callback_query) {
        const cq = update.callback_query;
        const chatId = String(cq.message.chat.id);
        const data: string = cq.data || "";
        await tgAnswer(cq.id);

        const PLANS = [
          { label: "⚡ Basique 24h — 2€", priceId: "price_1T4SndCvUJHVsIHmu06e2w6P", planId: "daily" },
          { label: "📅 Standard 7 jours — 5€", priceId: "price_1T4SndCvUJHVsIHmOlwzLsF6", planId: "weekly" },
          { label: "🌟 Premium 30 jours — 9€", priceId: "price_1T4SneCvUJHVsIHmPFJd4YeW", planId: "monthly" },
        ];

        if (data.startsWith("country_")) {
          const country = data.replace("country_", "") as "france" | "usa";
          tgSessions.set(chatId, { step: "choose_number", country });

          const available = await storage.getPhoneNumbers(country);
          const free = available.filter((n: any) => n.isAvailable && n.isValid && !n.activeReservation).slice(0, 6);

          if (free.length === 0) {
            await tgSend(chatId, "😔 Aucun numéro disponible pour ce pays en ce moment. Réessayez plus tard.");
            return res.sendStatus(200);
          }

          const flag = country === "france" ? "🇫🇷" : "🇺🇸";
          const keyboard = free.map((n: any) => [{ text: `${flag} ${n.number}`, callback_data: `number_${n.id}` }]);
          await tgSend(chatId, `${flag} Choisissez un numéro disponible :`, {
            reply_markup: { inline_keyboard: keyboard },
          });
        }

        else if (data.startsWith("number_")) {
          const phoneNumberId = data.replace("number_", "");
          const session = tgSessions.get(chatId) || { step: "choose_plan" };
          tgSessions.set(chatId, { ...session, step: "choose_plan", phoneNumberId });

          const keyboard = PLANS.map(p => [{ text: p.label, callback_data: `plan_${p.planId}` }]);
          await tgSend(chatId, "💳 Choisissez votre plan :", {
            reply_markup: { inline_keyboard: keyboard },
          });
        }

        else if (data.startsWith("plan_")) {
          const planId = data.replace("plan_", "");
          const session = tgSessions.get(chatId);
          if (!session?.phoneNumberId) {
            await tgSend(chatId, "❌ Session expirée. Recommencez avec /acheter");
            return res.sendStatus(200);
          }

          const plan = PLANS.find(p => p.planId === planId);
          if (!plan) return res.sendStatus(200);

          const phoneNumber = await storage.getPhoneNumber(session.phoneNumberId);
          if (!phoneNumber) {
            await tgSend(chatId, "❌ Ce numéro n'est plus disponible. Recommencez avec /acheter");
            return res.sendStatus(200);
          }

          const existing = await storage.getActiveReservation(session.phoneNumberId);
          if (existing) {
            await tgSend(chatId, "❌ Ce numéro vient d'être réservé. Recommencez avec /acheter pour en choisir un autre.");
            tgSessions.delete(chatId);
            return res.sendStatus(200);
          }

          const stripe = await getUncachableStripeClient();
          const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
          const userSessionId = `tg_${chatId}`;

          const stripeSession = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{ price: plan.priceId, quantity: 1 }],
            mode: 'payment',
            success_url: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}&phone_id=${session.phoneNumberId}&plan_id=${planId}&user_session=${userSessionId}`,
            cancel_url: `${baseUrl}/payment/cancel?phone_id=${session.phoneNumberId}`,
            metadata: {
              phoneNumberId: session.phoneNumberId,
              planId,
              userSessionId,
              telegramChatId: chatId,
            },
          });

          tgSessions.delete(chatId);

          await tgSend(chatId,
            `✅ Super ! Voici votre lien de paiement sécurisé pour le plan <b>${plan.label}</b>.\n\n` +
            `Une fois le paiement effectué, votre numéro sera activé automatiquement et vous recevrez les SMS ici.\n\n` +
            `⏳ Ce lien expire dans 30 minutes.`, {
            reply_markup: {
              inline_keyboard: [[{ text: "💳 Payer maintenant →", url: stripeSession.url! }]],
            },
          });
        }

        return res.sendStatus(200);
      }

      // ── Message texte ────────────────────────────────────────────────────
      const message = update?.message;
      if (!message || !message.text) return res.sendStatus(200);

      const chatId = String(message.chat.id);
      const text: string = message.text.trim();
      const firstName = message.chat.first_name || "ami(e)";

      if (text.startsWith("/start ")) {
        const token = text.split(" ")[1]?.trim();
        if (!token) return res.sendStatus(200);

        // Check if it's a compensation token
        const compensation = await storage.getCompensationToken(token);
        if (compensation) {
          if (compensation.usedAt) {
            await telegram.sendMessage(chatId, "⚠️ Ce lien de compensation a déjà été utilisé.");
            return res.sendStatus(200);
          }
          if (new Date(compensation.expiresAt) < new Date()) {
            await telegram.sendMessage(chatId, "❌ Ce lien de compensation a expiré.");
            return res.sendStatus(200);
          }

          const compensationLink = `${req.protocol}://${req.get("host")}/compensation/${token}`;
          await telegram.sendMessage(chatId, `🎁 *Lien de compensation GWADA SMS*\n\nMotif : ${compensation.reason || "Problème technique"}\n\nCliquez sur le lien ci-dessous pour choisir votre nouveau numéro gratuitement :\n${compensationLink}`);
          return res.sendStatus(200);
        }

        const [reservation] = await db.select().from(reservations).where(eq(reservations.telegramToken, token));

        if (!reservation) {
          await tgSend(chatId, "❌ Lien invalide ou expiré. Retournez sur GWADA SMS pour générer un nouveau lien.");
          return res.sendStatus(200);
        }

        // Enregistre le chat_id sur la réservation
        await db.update(reservations).set({ telegramChatId: chatId }).where(eq(reservations.telegramToken, token));

        // Récupère le numéro de téléphone associé
        const [phoneNum] = await db.select().from(phoneNumbers).where(eq(phoneNumbers.id, reservation.phoneNumberId));
        const flag = phoneNum?.country === "france" ? "🇫🇷" : "🇺🇸";
        const num = phoneNum?.number || "";

        await tgSend(chatId,
          `✅ <b>Connexion réussie, ${firstName} !</b>\n\nVous recevrez automatiquement les SMS arrivant sur votre numéro ${flag} <code>${num}</code> directement ici.\n\n📅 Valable jusqu'au ${new Date(reservation.expiresAt).toLocaleDateString("fr-FR")}`
        );

      } else if (text === "/start") {
        await tgSend(chatId,
          `👋 Bonjour <b>${firstName}</b> !\n\nJe suis le bot de <b>GWADA SMS</b> — votre service de numéros virtuels.\n\n` +
          `📱 <b>Que puis-je faire pour vous ?</b>\n` +
          `• <b>/acheter</b> — Acheter un numéro virtuel directement ici\n` +
          `• Connectez-vous sur <a href="https://${process.env.REPLIT_DOMAINS?.split(',')[0]}">gwada-sms.com</a> pour activer les notifications SMS\n\n` +
          `💬 Support disponible 7j/7`
        );

      } else if (text.startsWith("/acheter")) {
        const isAdmin = chatId === String(process.env.TELEGRAM_CHAT_ID);
        const parts = text.split(" ");
        const countryArg = parts[1]?.toLowerCase();

        // ── Commande admin : /acheter france | /acheter usa ─────────────
        if (isAdmin && (countryArg === "france" || countryArg === "usa")) {
          await tgSend(chatId, `⏳ Recherche d'un numéro ${countryArg === "france" ? "🇫🇷 France" : "🇺🇸 USA"} disponible sur Twilio…`);

          if (!twilioService.isConfigured()) {
            await tgSend(chatId, "❌ Twilio n'est pas configuré.");
            return res.sendStatus(200);
          }

          try {
            const countryCode = countryArg === "france" ? "FR" : countryArg === "canada" ? "CA" : "US";
            const available = await twilioService.searchAvailableNumbers(countryCode, 5);
            const candidate = available.find((n: any) => n.smsCapable);

            if (!candidate) {
              await tgSend(chatId, "😔 Aucun numéro SMS disponible trouvé sur Twilio pour ce pays.");
              return res.sendStatus(200);
            }

            await tgSend(chatId, `📞 Numéro trouvé : <code>${candidate.phoneNumber}</code>\nAchat en cours…`);

            const purchased = await twilioService.purchasePhoneNumber(candidate.phoneNumber, undefined, candidate.smsCapable);
            if (!purchased) {
              await tgSend(chatId, "❌ L'achat a échoué. Vérifiez votre compte Twilio (solde, bundle France, etc.).");
              return res.sendStatus(200);
            }

            const saved = await storage.createPhoneNumber({
              twilioSid: purchased.sid,
              number: purchased.phoneNumber,
              country: countryArg as "france" | "usa",
              isAvailable: true,
              isValid: true,
            });

            const flag = countryArg === "france" ? "🇫🇷" : countryArg === "canada" ? "🇨🇦" : "🇺🇸";
            await tgSend(chatId,
              `✅ <b>Numéro acheté avec succès !</b>\n\n` +
              `${flag} <code>${purchased.phoneNumber}</code>\n` +
              `SID : <code>${purchased.sid}</code>\n` +
              `ID base : <code>${saved.id}</code>\n\n` +
              `Le numéro est maintenant disponible pour les clients.`
            );
          } catch (err: any) {
            await tgSend(chatId, `❌ Erreur : <code>${err.message?.slice(0, 200)}</code>`);
          }
          return res.sendStatus(200);
        }

        // ── Aide admin si /acheter sans argument ──────────────────────────
        if (isAdmin && !countryArg) {
          await tgSend(chatId,
            `🛠️ <b>Commande admin — Achat de numéro Twilio</b>\n\n` +
            `Usage :\n` +
            `• <code>/acheter france</code> — Acheter un numéro 🇫🇷 France\n` +
            `• <code>/acheter usa</code> — Acheter un numéro 🇺🇸 USA\n\n` +
            `<i>Les clients utilisent cette commande pour acheter un numéro virtuel via Stripe.</i>`
          );
          return res.sendStatus(200);
        }

        // ── Flow client : /acheter (sans argument, non-admin) ─────────────
        tgSessions.set(chatId, { step: "choose_country" });
        await tgSend(chatId, "🌍 Choisissez le pays du numéro :", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🇫🇷 France (+33)", callback_data: "country_france" }],
              [{ text: "🇺🇸 USA (+1)", callback_data: "country_usa" }],
            ],
          },
        });
      }

      // ── Commandes admin uniquement ────────────────────────────────────────
      else if (chatId === String(process.env.TELEGRAM_CHAT_ID)) {

        // /numeros france | /numeros usa
        if (text.startsWith("/numeros")) {
          const arg = text.split(" ")[1]?.toLowerCase();
          const country = arg === "france" ? "france" : arg === "usa" ? "usa" : null;
          if (!country) {
            await tgSend(chatId, "Usage : <code>/numeros france</code> ou <code>/numeros usa</code>");
          } else {
            const nums = await storage.getPhoneNumbers(country as "france" | "usa");
            const flag = country === "france" ? "🇫🇷" : "🇺🇸";
            const lines = nums.slice(0, 20).map((n: any) => {
              const status = !n.isValid ? "❌ invalide" : n.activeReservation ? "🔒 réservé" : "✅ disponible";
              return `${flag} <code>${n.number}</code> — ${status}`;
            });
            const total = nums.length;
            const available = nums.filter((n: any) => n.isAvailable && n.isValid).length;
            const reserved = nums.filter((n: any) => n.activeReservation).length;
            const invalid = nums.filter((n: any) => !n.isValid).length;
            await tgSend(chatId,
              `📱 <b>Numéros ${flag} (${total})</b>\n` +
              `✅ ${available} disponibles • 🔒 ${reserved} réservés • ❌ ${invalid} invalides\n\n` +
              lines.join("\n")
            );
          }
        }

        // /maintenance on | /maintenance off
        else if (text.startsWith("/maintenance")) {
          const arg = text.split(" ")[1]?.toLowerCase();
          if (arg === "on" || arg === "off") {
            await storage.setSetting("maintenance_mode", arg === "on" ? "true" : "false");
            await tgSend(chatId, arg === "on"
              ? "🔧 <b>Mode maintenance activé</b> — Le site affiche la page de maintenance aux visiteurs."
              : "✅ <b>Mode maintenance désactivé</b> — Le site est de nouveau accessible."
            );
          } else {
            const current = await storage.getSetting("maintenance_mode");
            await tgSend(chatId,
              `🔧 Mode maintenance : <b>${current === "true" ? "ACTIVÉ" : "DÉSACTIVÉ"}</b>\n\n` +
              `Usage : <code>/maintenance on</code> ou <code>/maintenance off</code>`
            );
          }
        }

        // /sync — synchroniser Twilio
        else if (text === "/sync") {
          await tgSend(chatId, "🔄 Synchronisation avec Twilio en cours…");
          try {
            const result = await numberMonitor.syncTwilioNumbers();
            await tgSend(chatId,
              `✅ <b>Synchronisation terminée</b>\n\n` +
              `• Numéros synchronisés : <b>${result.synced}</b>\n` +
              `• Numéros invalidés : <b>${result.invalidated}</b>\n\n` +
              `📅 ${new Date().toLocaleString("fr-FR")}`
            );
          } catch (err: any) {
            await tgSend(chatId, `❌ Erreur sync : <code>${err.message?.slice(0, 200)}</code>`);
          }
        }

        // /revenus — revenus Stripe par période
        else if (text === "/revenus") {
          await tgSend(chatId, "⏳ Récupération des revenus Stripe…");
          try {
            const now = new Date();
            const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const start7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const start30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const [today, week, month] = await Promise.all([
              getStripeRevenueForPeriod(startToday, now),
              getStripeRevenueForPeriod(start7d, now),
              getStripeRevenueForPeriod(start30d, now),
            ]);
            const fmt = (n: number) => (n / 100).toFixed(2).replace(".", ",") + " €";
            await tgSend(chatId,
              `💰 <b>Revenus Stripe</b>\n\n` +
              `📅 Aujourd'hui : <b>${fmt(today.total)}</b> (${today.count} paiement${today.count > 1 ? "s" : ""})\n` +
              `📅 7 derniers jours : <b>${fmt(week.total)}</b> (${week.count} paiements)\n` +
              `📅 30 derniers jours : <b>${fmt(month.total)}</b> (${month.count} paiements)\n\n` +
              `📅 Mis à jour : ${now.toLocaleString("fr-FR")}`
            );
          } catch (err: any) {
            await tgSend(chatId, `❌ Erreur Stripe : <code>${err.message?.slice(0, 200)}</code>`);
          }
        }

        // /aide — liste des commandes admin
        else if (text === "/aide" || text === "/help") {
          await tgSend(chatId,
            `🛠️ <b>Commandes admin GWADA SMS</b>\n\n` +
            `<b>📊 Statistiques</b>\n` +
            `• <code>/revenus</code> — Revenus Stripe du jour / 7j / 30j\n` +
            `• <code>/numeros france</code> ou <code>/numeros usa</code> — Liste des numéros\n\n` +
            `<b>⚙️ Gestion</b>\n` +
            `• <code>/acheter france</code> ou <code>/acheter usa</code> — Acheter un numéro Twilio\n` +
            `• <code>/sync</code> — Synchroniser avec Twilio\n` +
            `• <code>/maintenance on|off</code> — Mode maintenance\n\n` +
            `<b>📅 Automatique</b>\n` +
            `• Rapport quotidien à 8h\n` +
            `• Rappel URSSAF fin de mois\n` +
            `• Alerte si aucun paiement 48h`
          );
        }
      }

      res.sendStatus(200);
    } catch (err: any) {
      console.error("[Telegram Webhook] Erreur:", err.message);
      res.sendStatus(200);
    }
  });

  app.post("/api/admin/test-sms", async (req, res) => {
    try {
      const { phoneNumberId, body, from } = req.body;
      const [msg] = await db.insert(smsMessages).values({
        phoneNumberId,
        body: body || "Ceci est un SMS de test pour GWADA SMS. Code: 123456",
        from: from || "+33600000000",
        twilioMessageSid: "SM" + Math.random().toString(36).substring(7),
      }).returning();

      // Notifier Telegram
      const [num] = await db.select().from(phoneNumbers).where(eq(phoneNumbers.id, phoneNumberId));
      if (num) {
        // Récupérer l'email du client s'il y a une réservation active
        const [reservation] = await db.execute(sql`
          SELECT u.email 
          FROM reservations r
          JOIN users u ON r.user_id = u.id
          WHERE r.phone_number_id = ${phoneNumberId} AND r.expires_at > NOW()
          LIMIT 1
        `);
        const userEmail = (reservation as any)?.email;
        await telegram.notifySmsReceived(num.number, msg.from, msg.body, num.country, userEmail);
      }

      res.json(msg);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  numberMonitor.startMonitoring(5 * 60 * 1000);
  startMonthlyReminder();
  startBotScheduler();
  startSmsPoller(30000);

  app.get("/api/stripe/publishable-key", async (req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      console.error("Error getting Stripe publishable key:", error);
      res.status(500).json({ error: "Stripe not configured" });
    }
  });

  app.get("/api/stripe/products", async (req, res) => {
    // Plans fixes — les price IDs correspondent aux prix créés dans le dashboard Stripe.
    // La table stripe.products (Replit integration) est vide ; on retourne directement
    // les données statiques pour ne pas bloquer le paiement.
    const products = [
      {
        id: "prod_daily",
        name: "Basique 24h",
        description: "Accès à un numéro virtuel pendant 24 heures",
        metadata: { planId: "daily" },
        prices: [{ id: "price_1T4SndCvUJHVsIHmu06e2w6P", unit_amount: 200, currency: "eur" }],
      },
      {
        id: "prod_weekly",
        name: "Standard 7 jours",
        description: "Accès à un numéro virtuel pendant 7 jours",
        metadata: { planId: "weekly" },
        prices: [{ id: "price_1T4SndCvUJHVsIHmOlwzLsF6", unit_amount: 500, currency: "eur" }],
      },
      {
        id: "prod_monthly",
        name: "Premium 30 jours",
        description: "Accès à un numéro virtuel pendant 30 jours",
        metadata: { planId: "monthly" },
        prices: [{ id: "price_1T4SneCvUJHVsIHmPFJd4YeW", unit_amount: 900, currency: "eur" }],
      },
    ];
    res.json({ products });
  });

  const checkoutSchema = z.object({
    priceId: z.string(),
    phoneNumberId: z.string(),
    planId: z.string(),
    sessionId: z.string(),
  });

  app.post("/api/stripe/create-checkout-session", async (req, res) => {
    try {
      const parseResult = checkoutSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid request data" });
      }

      const { priceId, phoneNumberId, planId, sessionId } = parseResult.data;

      const phoneNumber = await storage.getPhoneNumber(phoneNumberId);
      if (!phoneNumber) {
        return res.status(404).json({ error: "Phone number not found" });
      }

      const existingReservation = await storage.getActiveReservation(phoneNumberId);
      if (existingReservation) {
        return res.status(409).json({ error: "Ce numéro est déjà réservé" });
      }

      const hasUsed = await storage.hasBeenUsedBySession(phoneNumberId, sessionId);
      if (hasUsed) {
        return res.status(409).json({ error: "Vous avez déjà utilisé ce numéro" });
      }

      const stripe = await getUncachableStripeClient();
      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'payment',
        success_url: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}&phone_id=${phoneNumberId}&plan_id=${planId}&user_session=${sessionId}`,
        cancel_url: `${baseUrl}/payment/cancel?phone_id=${phoneNumberId}`,
        metadata: {
          phoneNumberId,
          planId,
          userSessionId: sessionId,
        },
      });

      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  app.post("/api/stripe/confirm-payment", async (req, res) => {
    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({ error: "Session ID requis" });
      }

      // Retrieve full session from Stripe — this is the source of truth
      const stripe = await getUncachableStripeClient();
      const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);

      if (checkoutSession.payment_status !== 'paid') {
        return res.status(400).json({ error: "Le paiement n'a pas encore été confirmé par Stripe." });
      }

      // Get metadata from Stripe session (reliable, not from URL params)
      const metadata = checkoutSession.metadata || {};
      const phoneNumberId = metadata.phoneNumberId;
      const planId = metadata.planId;
      const userSessionId = metadata.userSessionId;
      const telegramChatId = metadata.telegramChatId || null;

      if (!phoneNumberId || !planId) {
        return res.status(400).json({ error: "Métadonnées de session incomplètes" });
      }

      // Check if reservation already exists (created by webhook)
      let reservation = await storage.getActiveReservation(phoneNumberId);

      if (!reservation) {
        // Webhook hasn't processed yet — create reservation since Stripe confirmed payment
        const plan = pricingPlans.find(p => p.id === planId);
        if (!plan) return res.status(400).json({ error: "Plan invalide" });

        const now = new Date();
        const expiresAt = new Date(now.getTime() + plan.durationHours * 60 * 60 * 1000);

        let userId = req.session.userId || null;
        if (!userId && checkoutSession.customer_details?.email) {
          const [user] = await db.select().from(users).where(eq(users.email, checkoutSession.customer_details.email)).limit(1);
          if (user) userId = user.id;
        }

        reservation = await storage.createReservation({
          phoneNumberId,
          userId,
          planId,
          sessionId: userSessionId || 'confirm',
          startsAt: now,
          expiresAt,
          isActive: true,
        });

        await storage.recordUsage({
          phoneNumberId,
          sessionId: userSessionId || 'confirm',
          usedAt: now,
          purpose: `Paid reservation with ${plan.name} plan`,
        });

        await db.update(phoneNumbers).set({ isAvailable: false }).where(eq(phoneNumbers.id, phoneNumberId));
        console.log(`[ConfirmPayment] Created reservation for user ${userId || 'guest'} on ${phoneNumberId}`);

      } else if (!reservation.userId && req.session.userId) {
        // Webhook created as guest but user is logged in — link it to them
        await db.update(reservations)
          .set({ userId: req.session.userId })
          .where(eq(reservations.id, reservation.id));
        reservation = { ...reservation, userId: req.session.userId };
        console.log(`[ConfirmPayment] Linked reservation ${reservation.id} to user ${req.session.userId}`);
      }

      // ── Notification Telegram si achat via bot ───────────────────────────
      if (telegramChatId) {
        try {
          const [phoneNum] = await db.select().from(phoneNumbers).where(eq(phoneNumbers.id, phoneNumberId));
          if (phoneNum) {
            const flag = phoneNum.country === "france" ? "🇫🇷" : "🇺🇸";
            const expiryStr = new Date(reservation.expiresAt).toLocaleDateString("fr-FR", {
              day: "2-digit", month: "long", year: "numeric",
            });
            // Lier le telegramChatId à la réservation pour relayer les futurs SMS
            await db.update(reservations)
              .set({ telegramChatId })
              .where(eq(reservations.id, reservation.id));

            await telegram.sendMessage(
              telegramChatId,
              `✅ <b>Paiement confirmé !</b>\n\n` +
              `Votre numéro ${flag} <code>${phoneNum.number}</code> est maintenant actif.\n\n` +
              `📅 Valable jusqu'au <b>${expiryStr}</b>\n\n` +
              `📩 Les SMS reçus sur ce numéro vous seront transmis directement ici.\n\n` +
              `<i>Vous pouvez utiliser /acheter pour obtenir un autre numéro à tout moment.</i>`
            );
          }
        } catch (tgErr: any) {
          console.error("[ConfirmPayment] Telegram notification failed:", tgErr.message);
        }
      }

      res.json({
        success: true,
        reservation: {
          id: reservation.id,
          phoneNumberId: reservation.phoneNumberId,
          planId: reservation.planId,
          startsAt: reservation.startsAt.toISOString(),
          expiresAt: reservation.expiresAt.toISOString(),
        },
        message: `Numéro réservé avec succès`,
      });
    } catch (error: any) {
      console.error("Error confirming payment:", error);
      res.status(500).json({ error: error.message || "Erreur lors de la vérification du paiement" });
    }
  });

  // ─── Compensation System ──────────────────────────────────────────────────

  // Admin: mark/unmark a number as problematic
  app.post("/api/admin/numbers/:id/problematic", async (req, res) => {
    try {
      if (!req.session?.adminAuth) return res.status(401).json({ error: "Non autorisé" });
      const { isProblematic } = z.object({ isProblematic: z.boolean() }).parse(req.body);
      await storage.markNumberProblematic(req.params.id, isProblematic);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: list active basique reservations + compensation status
  app.get("/api/admin/compensation/basique-reservations", async (req, res) => {
    try {
      if (!req.session?.adminAuth) return res.status(401).json({ error: "Non autorisé" });
      const basique = await storage.getActiveBasiqueReservations();
      const problematic = await storage.getProblematicNumbers();
      const problematicIds = new Set(problematic.map((n) => n.id));

      const result = await Promise.all(basique.map(async (r) => {
        const tokens = await storage.getCompensationTokensByReservation(r.id);
        const activeToken = tokens.find((t) => !t.usedAt);
        return {
          reservationId: r.id,
          phoneNumber: r.phoneNumber?.number ?? "—",
          phoneNumberId: r.phoneNumber?.id ?? null,
          country: r.phoneNumber?.country ?? "france",
          isProblematic: r.phoneNumber ? problematicIds.has(r.phoneNumber.id) : false,
          userEmail: r.user?.email ?? null,
          expiresAt: r.expiresAt.toISOString(),
          hasActiveCompensation: !!activeToken,
          compensationLink: activeToken ? `${req.protocol}://${req.get("host")}/compensation/${activeToken.token}` : null,
        };
      }));
      res.json({ reservations: result, problematicCount: problematic.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: generate a compensation link for a reservation
  app.post("/api/admin/compensation/generate", async (req, res) => {
    try {
      if (!req.session?.adminAuth) return res.status(401).json({ error: "Non autorisé" });
      const { reservationId, reason, sendToTelegram } = z.object({ 
        reservationId: z.string(), 
        reason: z.string().optional(),
        sendToTelegram: z.boolean().optional()
      }).parse(req.body);

      const basique = await storage.getActiveBasiqueReservations();
      const reservation = basique.find((r) => r.id === reservationId);
      if (!reservation) return res.status(404).json({ error: "Réservation non trouvée ou non éligible" });

      const token = crypto.randomBytes(20).toString("hex");
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72h
      const country = (reservation.phoneNumber?.country ?? "france") as "france" | "usa";

      const comp = await storage.createCompensationToken({
        token,
        reservationId,
        planId: "daily",
        country,
        reason: reason || "Problème de réception SMS",
        expiresAt,
      });

      const botUsername = "GwadasmsBot";
      const telegramLink = `https://t.me/${botUsername}?start=${token}`;
      const webLink = `${req.protocol}://${req.get("host")}/compensation/${token}`;

      let sentViaTelegram = false;
      if (sendToTelegram && reservation.telegramChatId) {
        await telegram.sendMessage(reservation.telegramChatId, `🎁 *Lien de compensation GWADA SMS*\n\nMotif : ${comp.reason}\n\nCliquez sur le lien ci-dessous pour choisir votre nouveau numéro gratuitement :\n${webLink}`);
        sentViaTelegram = true;
      }

      res.json({ 
        success: true, 
        link: webLink, 
        telegramLink,
        sentViaTelegram,
        token: comp.token, 
        expiresAt: expiresAt.toISOString() 
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Public: get compensation token info
  app.get("/api/compensation/:token", async (req, res) => {
    try {
      const comp = await storage.getCompensationToken(req.params.token);
      if (!comp) return res.status(404).json({ error: "Lien invalide ou expiré" });
      if (comp.usedAt) return res.status(410).json({ error: "Ce lien a déjà été utilisé" });
      if (new Date(comp.expiresAt) < new Date()) return res.status(410).json({ error: "Ce lien a expiré" });

      // Get available numbers for same country
      const available = await storage.getPhoneNumbers(comp.country as "france" | "usa");
      res.json({
        token: comp.token,
        country: comp.country,
        planId: comp.planId,
        reason: comp.reason,
        expiresAt: comp.expiresAt.toISOString(),
        availableNumbers: available.map((n) => ({ id: n.id, number: n.number, country: n.country })),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Public: claim compensation — select a new number
  app.post("/api/compensation/:token/claim", async (req, res) => {
    try {
      const comp = await storage.getCompensationToken(req.params.token);
      if (!comp) return res.status(404).json({ error: "Lien invalide ou expiré" });
      if (comp.usedAt) return res.status(410).json({ error: "Ce lien a déjà été utilisé" });
      if (new Date(comp.expiresAt) < new Date()) return res.status(410).json({ error: "Ce lien a expiré" });

      const { phoneNumberId } = z.object({ phoneNumberId: z.string() }).parse(req.body);

      const phoneNumber = await storage.getPhoneNumber(phoneNumberId);
      if (!phoneNumber) return res.status(404).json({ error: "Numéro non trouvé" });
      if (!phoneNumber.isAvailable || !phoneNumber.isValid) return res.status(400).json({ error: "Ce numéro n'est plus disponible" });

      // Get original reservation details
      const [originalReservation] = await db.select().from(reservations).where(eq(reservations.id, comp.reservationId)).limit(1);
      const userId = originalReservation?.userId ?? null;

      const now = new Date();
      const plan = pricingPlans.find((p) => p.id === comp.planId) || pricingPlans[0];
      const expiresAt = new Date(now.getTime() + plan.durationHours * 60 * 60 * 1000);

      const newReservation = await storage.createReservation({
        phoneNumberId,
        userId: userId || null,
        planId: comp.planId,
        sessionId: `compensation-${comp.token}`,
        startsAt: now,
        expiresAt,
        isActive: true,
      });

      await db.update(phoneNumbers).set({ isAvailable: false }).where(eq(phoneNumbers.id, phoneNumberId));
      await storage.claimCompensationToken(comp.token, newReservation.id);

      res.json({
        success: true,
        reservation: {
          id: newReservation.id,
          phoneNumber: phoneNumber.number,
          phoneNumberId,
          expiresAt: expiresAt.toISOString(),
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
  // ─────────────────────────────────────────────────────────────────────────

  return httpServer;
}
