import { eq, and, gt, lt } from "drizzle-orm";
import { db } from "./db";
import {
  type User,
  type InsertUser,
  type PhoneNumber,
  type InsertPhoneNumber,
  type SmsMessage,
  type InsertSmsMessage,
  type Reservation,
  type InsertReservation,
  type UsageHistory,
  type InsertUsageHistory,
  type Country,
  users,
  phoneNumbers,
  smsMessages,
  reservations,
  usageHistory,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getPhoneNumbers(country: Country): Promise<PhoneNumber[]>;
  getPhoneNumber(id: string): Promise<PhoneNumber | undefined>;
  getPhoneNumberByTwilioSid(twilioSid: string): Promise<PhoneNumber | undefined>;
  createPhoneNumber(data: InsertPhoneNumber): Promise<PhoneNumber>;
  updatePhoneNumberAvailability(id: string, isAvailable: boolean): Promise<void>;
  updatePhoneNumberValidity(id: string, isValid: boolean): Promise<void>;
  
  getMessages(phoneNumberId: string): Promise<SmsMessage[]>;
  createMessage(data: InsertSmsMessage): Promise<SmsMessage>;
  getMessageByTwilioSid(twilioMessageSid: string): Promise<SmsMessage | undefined>;
  
  getActiveReservation(phoneNumberId: string): Promise<Reservation | undefined>;
  createReservation(data: InsertReservation): Promise<Reservation>;
  expireOldReservations(): Promise<void>;
  
  recordUsage(data: InsertUsageHistory): Promise<UsageHistory>;
  getUsageHistory(phoneNumberId: string): Promise<UsageHistory[]>;
  hasBeenUsedBySession(phoneNumberId: string, sessionId: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getPhoneNumbers(country: Country): Promise<PhoneNumber[]> {
    return db
      .select()
      .from(phoneNumbers)
      .where(
        and(
          eq(phoneNumbers.country, country),
          eq(phoneNumbers.isAvailable, true),
          eq(phoneNumbers.isValid, true)
        )
      );
  }

  async getPhoneNumber(id: string): Promise<PhoneNumber | undefined> {
    const [number] = await db.select().from(phoneNumbers).where(eq(phoneNumbers.id, id)).limit(1);
    return number;
  }

  async getPhoneNumberByTwilioSid(twilioSid: string): Promise<PhoneNumber | undefined> {
    const [number] = await db.select().from(phoneNumbers).where(eq(phoneNumbers.twilioSid, twilioSid)).limit(1);
    return number;
  }

  async createPhoneNumber(data: InsertPhoneNumber): Promise<PhoneNumber> {
    const [number] = await db.insert(phoneNumbers).values(data).returning();
    return number;
  }

  async updatePhoneNumberAvailability(id: string, isAvailable: boolean): Promise<void> {
    await db.update(phoneNumbers).set({ isAvailable }).where(eq(phoneNumbers.id, id));
  }

  async updatePhoneNumberValidity(id: string, isValid: boolean): Promise<void> {
    await db.update(phoneNumbers).set({ isValid, lastValidatedAt: new Date() }).where(eq(phoneNumbers.id, id));
  }

  async getMessages(phoneNumberId: string): Promise<SmsMessage[]> {
    return db
      .select()
      .from(smsMessages)
      .where(eq(smsMessages.phoneNumberId, phoneNumberId))
      .orderBy(smsMessages.receivedAt);
  }

  async createMessage(data: InsertSmsMessage): Promise<SmsMessage> {
    const [message] = await db.insert(smsMessages).values(data).returning();
    return message;
  }

  async getMessageByTwilioSid(twilioMessageSid: string): Promise<SmsMessage | undefined> {
    const [message] = await db.select().from(smsMessages).where(eq(smsMessages.twilioMessageSid, twilioMessageSid)).limit(1);
    return message;
  }

  async getActiveReservation(phoneNumberId: string): Promise<Reservation | undefined> {
    const now = new Date();
    const [reservation] = await db
      .select()
      .from(reservations)
      .where(
        and(
          eq(reservations.phoneNumberId, phoneNumberId),
          eq(reservations.isActive, true),
          gt(reservations.expiresAt, now)
        )
      )
      .limit(1);
    return reservation;
  }

  async createReservation(data: InsertReservation): Promise<Reservation> {
    const [reservation] = await db.insert(reservations).values(data).returning();
    await this.updatePhoneNumberAvailability(data.phoneNumberId, false);
    return reservation;
  }

  async expireOldReservations(): Promise<void> {
    const now = new Date();
    const expired = await db
      .select()
      .from(reservations)
      .where(
        and(
          eq(reservations.isActive, true),
          lt(reservations.expiresAt, now)
        )
      );

    for (const reservation of expired) {
      await db
        .update(reservations)
        .set({ isActive: false })
        .where(eq(reservations.id, reservation.id));
      await this.updatePhoneNumberAvailability(reservation.phoneNumberId, true);
    }
  }

  async recordUsage(data: InsertUsageHistory): Promise<UsageHistory> {
    const [usage] = await db.insert(usageHistory).values(data).returning();
    return usage;
  }

  async getUsageHistory(phoneNumberId: string): Promise<UsageHistory[]> {
    return db.select().from(usageHistory).where(eq(usageHistory.phoneNumberId, phoneNumberId));
  }

  async hasBeenUsedBySession(phoneNumberId: string, sessionId: string): Promise<boolean> {
    const [usage] = await db
      .select()
      .from(usageHistory)
      .where(
        and(
          eq(usageHistory.phoneNumberId, phoneNumberId),
          eq(usageHistory.sessionId, sessionId)
        )
      )
      .limit(1);
    return !!usage;
  }
}

export const storage = new DatabaseStorage();
