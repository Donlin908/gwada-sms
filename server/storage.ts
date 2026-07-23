import { eq, and, gt, lt, gte, lte, desc, sql as drizzleSql } from "drizzle-orm";
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
  type SystemSetting,
  type NumberAlert,
  type CompensationToken,
  type Review,
  type InsertReview,
  type SupportTicket,
  type InsertSupportTicket,
  users,
  phoneNumbers,
  smsMessages,
  reservations,
  usageHistory,
  systemSettings,
  numberAlerts,
  compensationTokens,
  reviews,
  supportTickets,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserVerification(userId: string, data: { emailVerified?: boolean; verificationToken?: string | null; verificationExpires?: Date | null }): Promise<void>;
  getReservationsByUserId(userId: string): Promise<Reservation[]>;
  
  getPhoneNumbers(country?: Country): Promise<PhoneNumber[]>;
  getPhoneNumber(id: string): Promise<PhoneNumber | undefined>;
  getPhoneNumberByTwilioSid(twilioSid: string): Promise<PhoneNumber | undefined>;
  getPhoneNumberByNumber(number: string): Promise<PhoneNumber | undefined>;
  createPhoneNumber(data: InsertPhoneNumber): Promise<PhoneNumber>;
  updatePhoneNumber(id: string, data: Partial<Pick<PhoneNumber, 'isAvailable' | 'isValid' | 'lastValidatedAt' | 'lastTwilioCheck' | 'country'>>): Promise<void>;
  updatePhoneNumberAvailability(id: string, isAvailable: boolean): Promise<void>;
  updatePhoneNumberValidity(id: string, isValid: boolean): Promise<void>;
  getPhoneNumbersNeedingTwilioCheck(olderThanMinutes: number): Promise<PhoneNumber[]>;
  
  getMessages(phoneNumberId: string, since?: Date): Promise<SmsMessage[]>;
  createMessage(data: InsertSmsMessage): Promise<SmsMessage>;
  getMessageByTwilioSid(twilioMessageSid: string): Promise<SmsMessage | undefined>;
  
  getActiveReservation(phoneNumberId: string): Promise<Reservation | undefined>;
  createReservation(data: InsertReservation): Promise<Reservation>;
  expireOldReservations(): Promise<void>;
  
  recordUsage(data: InsertUsageHistory): Promise<UsageHistory>;
  getUsageHistory(phoneNumberId: string): Promise<UsageHistory[]>;
  hasBeenUsedBySession(phoneNumberId: string, sessionId: string): Promise<boolean>;
  
  incrementUsageCount(phoneNumberId: string): Promise<number>;
  getNumbersNearingLimit(threshold: number): Promise<PhoneNumber[]>;
  getAllPhoneNumbers(): Promise<PhoneNumber[]>;
  
  getSetting(key: string): Promise<string | undefined>;
  setSetting(key: string, value: string): Promise<void>;
  
  createAlert(phoneNumberId: string, alertType: string, usageCount: number): Promise<NumberAlert>;
  getUnsentAlerts(): Promise<NumberAlert[]>;
  getAllAlerts(): Promise<NumberAlert[]>;
  markAlertSent(alertId: string): Promise<void>;

  markNumberProblematic(phoneNumberId: string, isProblematic: boolean): Promise<void>;
  getProblematicNumbers(): Promise<PhoneNumber[]>;

  incrementSmsReceivedCount(phoneNumberId: string): Promise<void>;
  getSmsCountForPeriod(phoneNumberId: string, from: Date, to: Date): Promise<number>;
  getExpiredUncheckedReservations(): Promise<Reservation[]>;
  markReservationQualityChecked(reservationId: string): Promise<void>;
  incrementReservationsWithoutSms(phoneNumberId: string): Promise<void>;
  retireNumberForQuality(phoneNumberId: string): Promise<void>;
  getActiveBasiqueReservations(): Promise<(Reservation & { phoneNumber: PhoneNumber | null; user: User | null })[]>;
  getActiveReservations(planId?: string): Promise<(Reservation & { phoneNumber: PhoneNumber | null; user: User | null })[]>;
  createCompensationToken(data: { token: string; reservationId: string; planId: string; country: Country; reason?: string; expiresAt: Date }): Promise<CompensationToken>;
  getCompensationToken(token: string): Promise<CompensationToken | undefined>;
  claimCompensationToken(token: string, newReservationId: string): Promise<void>;
  getCompensationTokensByReservation(reservationId: string): Promise<CompensationToken[]>;
  getAllCompensationTokens(): Promise<CompensationToken[]>;

  getReviews(): Promise<Review[]>;
  getAllReviewsAdmin(): Promise<Review[]>;
  createReview(data: InsertReview): Promise<Review>;
  publishReview(id: string): Promise<Review>;
  deleteReview(id: string): Promise<void>;

  createSupportTicket(data: InsertSupportTicket & { userId?: string }): Promise<SupportTicket>;
  getSupportTickets(): Promise<SupportTicket[]>;
  getSupportTicket(id: string): Promise<SupportTicket | undefined>;
  updateSupportTicket(id: string, data: { status?: string; adminResponse?: string }): Promise<void>;
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

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.verificationToken, token)).limit(1);
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUserVerification(userId: string, data: { emailVerified?: boolean; verificationToken?: string | null; verificationExpires?: Date | null }): Promise<void> {
    await db.update(users).set(data).where(eq(users.id, userId));
  }

  async getReservationsByUserId(userId: string): Promise<Reservation[]> {
    return db
      .select()
      .from(reservations)
      .where(eq(reservations.userId, userId))
      .orderBy(reservations.createdAt);
  }

  async getPhoneNumbers(country?: Country): Promise<PhoneNumber[]> {
    const conditions = [
      eq(phoneNumbers.isAvailable, true),
      eq(phoneNumbers.isValid, true),
    ];
    if (country) conditions.push(eq(phoneNumbers.country, country));
    return db.select().from(phoneNumbers).where(and(...conditions));
  }

  async getPhoneNumber(id: string): Promise<PhoneNumber | undefined> {
    const [number] = await db.select().from(phoneNumbers).where(eq(phoneNumbers.id, id)).limit(1);
    return number;
  }

  async getPhoneNumberByTwilioSid(twilioSid: string): Promise<PhoneNumber | undefined> {
    const [number] = await db.select().from(phoneNumbers).where(eq(phoneNumbers.twilioSid, twilioSid)).limit(1);
    return number;
  }

  async getPhoneNumberByNumber(number: string): Promise<PhoneNumber | undefined> {
    const [row] = await db.select().from(phoneNumbers).where(eq(phoneNumbers.number, number)).limit(1);
    return row;
  }

  async createPhoneNumber(data: InsertPhoneNumber): Promise<PhoneNumber> {
    const [number] = await db.insert(phoneNumbers).values(data).returning();
    return number;
  }

  async updatePhoneNumber(id: string, data: Partial<Pick<PhoneNumber, 'isAvailable' | 'isValid' | 'lastValidatedAt' | 'lastTwilioCheck' | 'country'>>): Promise<void> {
    await db.update(phoneNumbers).set(data).where(eq(phoneNumbers.id, id));
  }

  async updatePhoneNumberAvailability(id: string, isAvailable: boolean): Promise<void> {
    await db.update(phoneNumbers).set({ isAvailable }).where(eq(phoneNumbers.id, id));
  }

  async updatePhoneNumberValidity(id: string, isValid: boolean): Promise<void> {
    await db.update(phoneNumbers).set({ isValid, lastValidatedAt: new Date() }).where(eq(phoneNumbers.id, id));
  }

  async getPhoneNumbersNeedingTwilioCheck(olderThanMinutes: number): Promise<PhoneNumber[]> {
    const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    const all = await db.select().from(phoneNumbers).where(eq(phoneNumbers.isValid, true));
    return all.filter(n => !n.lastTwilioCheck || n.lastTwilioCheck < cutoff);
  }

  async getMessages(phoneNumberId: string, since?: Date): Promise<SmsMessage[]> {
    const conditions = [eq(smsMessages.phoneNumberId, phoneNumberId)];
    if (since) {
      conditions.push(gte(smsMessages.receivedAt, since));
    }
    return db
      .select()
      .from(smsMessages)
      .where(and(...conditions))
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
    await this.incrementUsageCount(data.phoneNumberId);
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

  async incrementUsageCount(phoneNumberId: string): Promise<number> {
    const [number] = await db.select().from(phoneNumbers).where(eq(phoneNumbers.id, phoneNumberId)).limit(1);
    if (!number) return 0;
    
    const newCount = (number.usageCount || 0) + 1;
    await db.update(phoneNumbers).set({ usageCount: newCount }).where(eq(phoneNumbers.id, phoneNumberId));
    return newCount;
  }

  async getNumbersNearingLimit(threshold: number): Promise<PhoneNumber[]> {
    return db.select().from(phoneNumbers).where(
      and(
        gte(phoneNumbers.usageCount, threshold),
        eq(phoneNumbers.isValid, true)
      )
    );
  }

  async getAllPhoneNumbers(): Promise<PhoneNumber[]> {
    return db.select().from(phoneNumbers);
  }

  async getSetting(key: string): Promise<string | undefined> {
    const [setting] = await db.select().from(systemSettings).where(eq(systemSettings.key, key)).limit(1);
    return setting?.value;
  }

  async setSetting(key: string, value: string): Promise<void> {
    const existing = await this.getSetting(key);
    if (existing !== undefined) {
      await db.update(systemSettings).set({ value, updatedAt: new Date() }).where(eq(systemSettings.key, key));
    } else {
      await db.insert(systemSettings).values({ key, value });
    }
  }

  async createAlert(phoneNumberId: string, alertType: string, usageCount: number): Promise<NumberAlert> {
    const [alert] = await db.insert(numberAlerts).values({
      phoneNumberId,
      alertType,
      usageCountAtAlert: usageCount,
      emailSent: false,
    }).returning();
    return alert;
  }

  async getUnsentAlerts(): Promise<NumberAlert[]> {
    return db.select().from(numberAlerts).where(eq(numberAlerts.emailSent, false));
  }

  async getAllAlerts(): Promise<NumberAlert[]> {
    return db.select().from(numberAlerts);
  }

  async markAlertSent(alertId: string): Promise<void> {
    await db.update(numberAlerts).set({ emailSent: true }).where(eq(numberAlerts.id, alertId));
  }

  async markNumberProblematic(phoneNumberId: string, isProblematic: boolean): Promise<void> {
    await db.update(phoneNumbers).set({ isProblematic }).where(eq(phoneNumbers.id, phoneNumberId));
  }

  async getProblematicNumbers(): Promise<PhoneNumber[]> {
    return db.select().from(phoneNumbers).where(eq(phoneNumbers.isProblematic, true));
  }

  async incrementSmsReceivedCount(phoneNumberId: string): Promise<void> {
    await db.update(phoneNumbers)
      .set({ smsReceivedCount: drizzleSql`${phoneNumbers.smsReceivedCount} + 1` })
      .where(eq(phoneNumbers.id, phoneNumberId));
  }

  async getSmsCountForPeriod(phoneNumberId: string, from: Date, to: Date): Promise<number> {
    const result = await db
      .select({ count: drizzleSql<number>`count(*)::int` })
      .from(smsMessages)
      .where(
        and(
          eq(smsMessages.phoneNumberId, phoneNumberId),
          gte(smsMessages.receivedAt, from),
          lte(smsMessages.receivedAt, to)
        )
      );
    return result[0]?.count ?? 0;
  }

  async getExpiredUncheckedReservations(): Promise<Reservation[]> {
    const now = new Date();
    return db
      .select()
      .from(reservations)
      .where(
        and(
          eq(reservations.isActive, false),
          eq(reservations.qualityChecked, false),
          lt(reservations.expiresAt, now)
        )
      );
  }

  async markReservationQualityChecked(reservationId: string): Promise<void> {
    await db.update(reservations).set({ qualityChecked: true }).where(eq(reservations.id, reservationId));
  }

  async incrementReservationsWithoutSms(phoneNumberId: string): Promise<void> {
    await db.update(phoneNumbers)
      .set({ reservationsWithoutSms: drizzleSql`${phoneNumbers.reservationsWithoutSms} + 1` })
      .where(eq(phoneNumbers.id, phoneNumberId));
  }

  async retireNumberForQuality(phoneNumberId: string): Promise<void> {
    await db.update(phoneNumbers)
      .set({ isValid: false, isProblematic: true, isAvailable: false, lastValidatedAt: new Date() })
      .where(eq(phoneNumbers.id, phoneNumberId));
  }

  async getActiveBasiqueReservations(): Promise<(Reservation & { phoneNumber: PhoneNumber | null; user: User | null })[]> {
    return this.getActiveReservations("daily");
  }

  async getActiveReservations(planId?: string): Promise<(Reservation & { phoneNumber: PhoneNumber | null; user: User | null })[]> {
    const now = new Date();
    const conditions = [
      eq(reservations.isActive, true),
      gt(reservations.expiresAt, now),
    ];
    if (planId) conditions.push(eq(reservations.planId, planId));
    const rows = await db
      .select({
        reservation: reservations,
        phoneNumber: phoneNumbers,
        user: users,
      })
      .from(reservations)
      .leftJoin(phoneNumbers, eq(reservations.phoneNumberId, phoneNumbers.id))
      .leftJoin(users, eq(reservations.userId, users.id))
      .where(and(...conditions))
      .orderBy(reservations.createdAt);
    return rows.map((r) => ({ ...r.reservation, phoneNumber: r.phoneNumber, user: r.user }));
  }

  async createCompensationToken(data: { token: string; reservationId: string; planId: string; country: Country; reason?: string; expiresAt: Date }): Promise<CompensationToken> {
    const [token] = await db.insert(compensationTokens).values(data).returning();
    return token;
  }

  async getCompensationToken(token: string): Promise<CompensationToken | undefined> {
    const [row] = await db.select().from(compensationTokens).where(eq(compensationTokens.token, token)).limit(1);
    return row;
  }

  async claimCompensationToken(token: string, newReservationId: string): Promise<void> {
    await db.update(compensationTokens).set({ usedAt: new Date(), newReservationId }).where(eq(compensationTokens.token, token));
  }

  async getCompensationTokensByReservation(reservationId: string): Promise<CompensationToken[]> {
    return db.select().from(compensationTokens).where(eq(compensationTokens.reservationId, reservationId));
  }

  async getAllCompensationTokens(): Promise<CompensationToken[]> {
    return db.select().from(compensationTokens).orderBy(compensationTokens.createdAt);
  }

  async getReviews(): Promise<Review[]> {
    return db.select().from(reviews).where(eq(reviews.published, true)).orderBy(desc(reviews.createdAt));
  }

  async getAllReviewsAdmin(): Promise<Review[]> {
    return db.select().from(reviews).orderBy(desc(reviews.createdAt));
  }

  async createReview(data: InsertReview): Promise<Review> {
    const [review] = await db.insert(reviews).values(data).returning();
    return review;
  }

  async publishReview(id: string): Promise<Review> {
    const [review] = await db.update(reviews).set({ published: true }).where(eq(reviews.id, id)).returning();
    return review;
  }

  async deleteReview(id: string): Promise<void> {
    await db.delete(reviews).where(eq(reviews.id, id));
  }

  async createSupportTicket(data: InsertSupportTicket & { userId?: string }): Promise<SupportTicket> {
    const [ticket] = await db.insert(supportTickets).values(data).returning();
    return ticket;
  }

  async getSupportTickets(): Promise<SupportTicket[]> {
    return db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt));
  }

  async getSupportTicket(id: string): Promise<SupportTicket | undefined> {
    const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, id)).limit(1);
    return ticket;
  }

  async updateSupportTicket(id: string, data: { status?: string; adminResponse?: string }): Promise<void> {
    await db.update(supportTickets).set({ ...data, updatedAt: new Date() }).where(eq(supportTickets.id, id));
  }
}

export const storage = new DatabaseStorage();
