import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type Country = "france" | "usa";

export interface PhoneNumber {
  id: string;
  number: string;
  country: Country;
  isAvailable: boolean;
  lastActive: string;
}

export interface SmsMessage {
  id: string;
  phoneNumberId: string;
  sender: string;
  content: string;
  receivedAt: string;
}

export interface PricingPlan {
  id: string;
  name: string;
  duration: string;
  price: number;
  savings?: string;
  features: string[];
  isRecommended: boolean;
}

export const pricingPlans: PricingPlan[] = [
  {
    id: "daily",
    name: "24 Heures",
    duration: "24h",
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
