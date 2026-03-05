import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { type Country, pricingPlans, phoneNumbers, reservations, users } from "@shared/schema";
import * as twilioService from "./twilio-service";
import * as numberMonitor from "./number-monitor";
import { isEmailConfigured, sendVerificationEmail } from "./email-service";
import * as telegram from "./telegram-service";
import { z } from "zod";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { sql, eq } from "drizzle-orm";
import { db } from "./db";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const adminSettingsSchema = z.object({
  usageAlertThreshold: z.number().int().min(1).max(10000).optional(),
  autoPurchaseEnabled: z.boolean().optional(),
  minNumbersPerCountry: z.number().int().min(1).max(100).optional(),
  adminEmail: z.string().email().optional(),
  maxUsagesDaily: z.number().int().min(1).max(1000).optional(),
  maxUsagesWeekly: z.number().int().min(1).max(1000).optional(),
  maxUsagesMonthly: z.number().int().min(1).max(1000).optional(),
});

const purchaseNumberSchema = z.object({
  country: z.enum(["france", "usa"]),
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
      if (country !== "france" && country !== "usa") {
        return res.status(400).json({ error: "Invalid country. Use 'france' or 'usa'." });
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
              const flag = phoneNumber.country === "france" ? "🇫🇷" : "🇺🇸";
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
      const maxUsagesDaily = await storage.getSetting("max_usages_daily") || "20";
      const maxUsagesWeekly = await storage.getSetting("max_usages_weekly") || "10";
      const maxUsagesMonthly = await storage.getSetting("max_usages_monthly") || "5";
      const franceBundleRequired = await storage.getSetting("france_bundle_required") || "false";
      
      res.json({
        ...stats,
        settings: {
          usageAlertThreshold: parseInt(usageThreshold),
          autoPurchaseEnabled: autoPurchaseEnabled === "true",
          minNumbersPerCountry: parseInt(minPerCountry),
          maxUsagesDaily: parseInt(maxUsagesDaily),
          maxUsagesWeekly: parseInt(maxUsagesWeekly),
          maxUsagesMonthly: parseInt(maxUsagesMonthly),
          franceBundleRequired: franceBundleRequired === "true",
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
      
      const { usageAlertThreshold, autoPurchaseEnabled, minNumbersPerCountry, adminEmail, maxUsagesDaily, maxUsagesWeekly, maxUsagesMonthly } = parseResult.data;
      
      if (usageAlertThreshold !== undefined) {
        await storage.setSetting("usage_alert_threshold", String(usageAlertThreshold));
      }
      if (autoPurchaseEnabled !== undefined) {
        await storage.setSetting("auto_purchase_enabled", String(autoPurchaseEnabled));
      }
      if (minNumbersPerCountry !== undefined) {
        await storage.setSetting("min_numbers_per_country", String(minNumbersPerCountry));
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
      
      const countryCode = country === "france" ? "FR" : "US";
      const available = await twilioService.searchAvailableNumbers(countryCode, 5);
      const smsCandidate = available.find(n => n.smsCapable);

      if (!smsCandidate) {
        return res.status(404).json({ error: "Aucun numéro compatible SMS disponible dans cette région" });
      }
      
      const purchased = await twilioService.purchasePhoneNumber(smsCandidate.phoneNumber, undefined, smsCandidate.smsCapable);
      if (!purchased) {
        return res.status(500).json({ error: "Failed to purchase number" });
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

  app.post("/api/reservations/:id/telegram", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Non authentifié");
    try {
      const { id } = req.params;
      let { chatId } = req.body;

      const [reservation] = await db.select().from(reservations).where(eq(reservations.id, id));
      if (!reservation || reservation.userId !== (req.user as any).id) {
        return res.status(404).send("Réservation non trouvée");
      }

      // Si c'est un numéro de téléphone, on essaie de trouver le Chat ID via getUpdates
      if (chatId && !/^-?\[0-9\]+$/.test(chatId)) {
        const cleanPhone = chatId.replace(/\D/g, "");
        const token = process.env.TELEGRAM_BOT_TOKEN;
        const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
        const data = await response.json() as any;
        
        if (data.ok && data.result.length > 0) {
          // On cherche un message qui vient d'un utilisateur avec ce numéro (si partagé) 
          // ou on fait au plus simple: on demande au bot d'envoyer un message de bienvenue si l'ID est trouvé
          // Note: Telegram ne donne pas le numéro de téléphone par défaut. 
          // Le plus fiable reste l'ID, mais je vais simplifier le message pour l'utilisateur.
        }
      }

      await db.update(reservations).set({ telegramChatId: chatId }).where(eq(reservations.id, id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
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
    try {
      const result = await db.execute(sql`
        SELECT 
          p.id as product_id,
          p.name as product_name,
          p.description as product_description,
          p.metadata as product_metadata,
          pr.id as price_id,
          pr.unit_amount,
          pr.currency
        FROM stripe.products p
        LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
        WHERE p.active = true
        ORDER BY pr.unit_amount ASC
      `);
      
      const productsMap = new Map();
      for (const row of result.rows as any[]) {
        if (!productsMap.has(row.product_id)) {
          productsMap.set(row.product_id, {
            id: row.product_id,
            name: row.product_name,
            description: row.product_description,
            metadata: row.product_metadata,
            prices: []
          });
        }
        if (row.price_id) {
          productsMap.get(row.product_id).prices.push({
            id: row.price_id,
            unit_amount: row.unit_amount,
            currency: row.currency,
          });
        }
      }

      res.json({ products: Array.from(productsMap.values()) });
    } catch (error) {
      console.error("Error fetching Stripe products:", error);
      res.json({ products: [] });
    }
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

  return httpServer;
}
