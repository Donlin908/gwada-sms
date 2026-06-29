import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username"),
  email: text("email").notNull().unique(),
  password: text("password"),
  emailVerified: boolean("email_verified").notNull().default(false),
  verificationToken: text("verification_token"),
  verificationExpires: timestamp("verification_expires"),
  authProvider: text("auth_provider").notNull().default("local"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImageUrl: text("profile_image_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type Country = "france" | "usa" | "canada";

export const phoneNumbers = pgTable("phone_numbers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  twilioSid: text("twilio_sid").notNull().unique(),
  number: text("number").notNull(),
  country: text("country").notNull().$type<Country>(),
  isAvailable: boolean("is_available").notNull().default(true),
  isValid: boolean("is_valid").notNull().default(true),
  usageCount: integer("usage_count").notNull().default(0),
  isProblematic: boolean("is_problematic").notNull().default(false),
  lastValidatedAt: timestamp("last_validated_at"),
  lastTwilioCheck: timestamp("last_twilio_check"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPhoneNumberSchema = createInsertSchema(phoneNumbers).omit({
  id: true,
  createdAt: true,
});

export type InsertPhoneNumber = z.infer<typeof insertPhoneNumberSchema>;
export type PhoneNumber = typeof phoneNumbers.$inferSelect;

export const reservations = pgTable("reservations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phoneNumberId: varchar("phone_number_id").notNull().references(() => phoneNumbers.id),
  userId: varchar("user_id").references(() => users.id),
  telegramChatId: text("telegram_chat_id"),
  telegramToken: text("telegram_token"),
  planId: text("plan_id").notNull(),
  sessionId: text("session_id").notNull(),
  startsAt: timestamp("starts_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertReservationSchema = createInsertSchema(reservations).omit({
  id: true,
  createdAt: true,
});

export type InsertReservation = z.infer<typeof insertReservationSchema>;
export type Reservation = typeof reservations.$inferSelect;

export const usageHistory = pgTable("usage_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phoneNumberId: varchar("phone_number_id").notNull().references(() => phoneNumbers.id),
  sessionId: text("session_id").notNull(),
  usedAt: timestamp("used_at").notNull().defaultNow(),
  purpose: text("purpose"),
});

export const insertUsageHistorySchema = createInsertSchema(usageHistory).omit({
  id: true,
});

export type InsertUsageHistory = z.infer<typeof insertUsageHistorySchema>;
export type UsageHistory = typeof usageHistory.$inferSelect;

export const smsMessages = pgTable("sms_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phoneNumberId: varchar("phone_number_id").notNull().references(() => phoneNumbers.id),
  twilioMessageSid: text("twilio_message_sid").unique(),
  sender: text("sender").notNull(),
  content: text("content").notNull(),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
});

export const insertSmsMessageSchema = createInsertSchema(smsMessages).omit({
  id: true,
});

export type InsertSmsMessage = z.infer<typeof insertSmsMessageSchema>;
export type SmsMessage = typeof smsMessages.$inferSelect;

export const systemSettings = pgTable("system_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type SystemSetting = typeof systemSettings.$inferSelect;

export const compensationTokens = pgTable("compensation_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  token: text("token").notNull().unique(),
  reservationId: varchar("reservation_id").notNull().references(() => reservations.id),
  planId: text("plan_id").notNull(),
  country: text("country").notNull().$type<Country>(),
  reason: text("reason"),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  newReservationId: varchar("new_reservation_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type CompensationToken = typeof compensationTokens.$inferSelect;

export const supportTickets = pgTable("support_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  reservationId: varchar("reservation_id").references(() => reservations.id),
  phoneNumber: text("phone_number"),
  category: text("category").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("open"),
  adminResponse: text("admin_response"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({ id: true, createdAt: true, updatedAt: true, status: true, adminResponse: true }).extend({
  category: z.enum(["sms_not_received", "telegram", "payment", "wrong_number", "other"]),
  message: z.string().min(10, "Décrivez le problème en au moins 10 caractères").max(2000),
  phoneNumber: z.string().optional(),
  reservationId: z.string().optional(),
});

export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type SupportTicket = typeof supportTickets.$inferSelect;

export const reviews = pgTable("reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertReviewSchema = createInsertSchema(reviews).omit({ id: true, createdAt: true }).extend({
  name: z.string().min(2, "Le nom doit faire au moins 2 caractères").max(50),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(10, "Le commentaire doit faire au moins 10 caractères").max(500),
});

export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviews.$inferSelect;

export const numberAlerts = pgTable("number_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phoneNumberId: varchar("phone_number_id").notNull().references(() => phoneNumbers.id),
  alertType: text("alert_type").notNull(),
  usageCountAtAlert: integer("usage_count_at_alert").notNull(),
  emailSent: boolean("email_sent").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type NumberAlert = typeof numberAlerts.$inferSelect;

export interface PricingPlan {
  id: string;
  name: string;
  duration: string;
  durationHours: number;
  price: number;
  savings?: string;
  features: string[];
  isRecommended: boolean;
}

export interface AvailabilityByPlan {
  daily: boolean;
  weekly: boolean;
  monthly: boolean;
}

export interface PhoneNumberResponse {
  id: string;
  number: string;
  country: Country;
  isAvailable: boolean;
  isValid: boolean;
  twilioActive: boolean;
  usageCount: number;
  maxUsageDaily: number;
  maxUsageWeekly: number;
  maxUsageMonthly: number;
  availabilityByPlan: AvailabilityByPlan;
  lastActive: string;
  lastTwilioCheck: string | null;
}

export interface SmsMessageResponse {
  id: string;
  phoneNumberId: string;
  sender: string;
  content: string;
  receivedAt: string;
}

export const pricingPlans: PricingPlan[] = [
  {
    id: "daily",
    name: "24 Heures",
    duration: "24h",
    durationHours: 24,
    price: 2,
    features: [
      "1 numéro au choix",
      "SMS illimités",
      "Réception instantanée",
      "Expiration auto"
    ],
    isRecommended: false
  },
  {
    id: "weekly",
    name: "7 Jours",
    duration: "7 jours",
    durationHours: 24 * 7,
    price: 5,
    savings: "Économisez 64%",
    features: [
      "1 numéro au choix",
      "SMS illimités",
      "Réception instantanée",
      "Expiration auto",
      "Support prioritaire"
    ],
    isRecommended: false
  },
  {
    id: "monthly",
    name: "30 Jours",
    duration: "30 jours",
    durationHours: 24 * 30,
    price: 9,
    savings: "Meilleure offre",
    features: [
      "1 numéro au choix",
      "SMS illimités",
      "Réception instantanée",
      "Expiration auto",
      "Support prioritaire",
      "Historique complet"
    ],
    isRecommended: true
  }
];
