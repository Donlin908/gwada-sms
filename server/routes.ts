import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { type Country, pricingPlans } from "@shared/schema";
import * as twilioService from "./twilio-service";
import * as numberMonitor from "./number-monitor";
import { isEmailConfigured } from "./email-service";
import { z } from "zod";

const adminSettingsSchema = z.object({
  usageAlertThreshold: z.number().int().min(1).max(10000).optional(),
  autoPurchaseEnabled: z.boolean().optional(),
  minNumbersPerCountry: z.number().int().min(1).max(100).optional(),
  adminEmail: z.string().email().optional(),
});

const purchaseNumberSchema = z.object({
  country: z.enum(["france", "usa"]),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.get("/api/numbers", async (req, res) => {
    try {
      const country = (req.query.country as Country) || "france";
      if (country !== "france" && country !== "usa") {
        return res.status(400).json({ error: "Invalid country. Use 'france' or 'usa'." });
      }
      
      await storage.expireOldReservations();
      
      const numbers = await storage.getPhoneNumbers(country);
      
      const formattedNumbers = numbers.map(num => ({
        id: num.id,
        number: num.number,
        country: num.country,
        isAvailable: num.isAvailable,
        isValid: num.isValid,
        lastActive: num.lastValidatedAt?.toISOString() || new Date().toISOString(),
      }));
      
      res.json(formattedNumbers);
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

  app.get("/api/admin/stats", async (req, res) => {
    try {
      const stats = await numberMonitor.getMonitoringStats();
      const emailConfigured = isEmailConfigured();
      const twilioConfigured = twilioService.isConfigured();
      
      const usageThreshold = await storage.getSetting("usage_alert_threshold") || "100";
      const autoPurchaseEnabled = await storage.getSetting("auto_purchase_enabled") || "false";
      const minPerCountry = await storage.getSetting("min_numbers_per_country") || "3";
      
      res.json({
        ...stats,
        settings: {
          usageAlertThreshold: parseInt(usageThreshold),
          autoPurchaseEnabled: autoPurchaseEnabled === "true",
          minNumbersPerCountry: parseInt(minPerCountry),
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
      
      const { usageAlertThreshold, autoPurchaseEnabled, minNumbersPerCountry, adminEmail } = parseResult.data;
      
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
      const numbers = await storage.getAllPhoneNumbers();
      res.json(numbers.map(n => ({
        id: n.id,
        number: n.number,
        country: n.country,
        usageCount: n.usageCount,
        isAvailable: n.isAvailable,
        isValid: n.isValid,
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
      const available = await twilioService.searchAvailableNumbers(countryCode, 1);
      
      if (available.length === 0) {
        return res.status(404).json({ error: "No numbers available for purchase in this region" });
      }
      
      const purchased = await twilioService.purchasePhoneNumber(available[0].phoneNumber);
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

  numberMonitor.startMonitoring(5 * 60 * 1000);

  return httpServer;
}
