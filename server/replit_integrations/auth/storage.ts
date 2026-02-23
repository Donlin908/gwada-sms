import { users, type User } from "@shared/schema";
import type { UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { eq } from "drizzle-orm";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existingByEmail = userData.email ? await this.getUserByEmail(userData.email) : undefined;

    if (existingByEmail) {
      const [user] = await db
        .update(users)
        .set({
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          emailVerified: true,
        })
        .where(eq(users.id, existingByEmail.id))
        .returning();
      return user;
    }

    const displayName = [userData.firstName, userData.lastName].filter(Boolean).join(" ") || userData.email?.split("@")[0] || "user";

    const [user] = await db
      .insert(users)
      .values({
        id: userData.id,
        email: userData.email || "",
        username: displayName,
        authProvider: "google",
        emailVerified: true,
        firstName: userData.firstName,
        lastName: userData.lastName,
        profileImageUrl: userData.profileImageUrl,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          emailVerified: true,
        },
      })
      .returning();
    return user;
  }
}

export const authStorage = new AuthStorage();
