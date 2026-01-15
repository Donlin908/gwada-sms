import { type User, type InsertUser, type PhoneNumber, type SmsMessage, type Country } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getPhoneNumbers(country: Country): Promise<PhoneNumber[]>;
  getPhoneNumber(id: string): Promise<PhoneNumber | undefined>;
  getMessages(phoneNumberId: string): Promise<SmsMessage[]>;
}

const frenchNumbers: PhoneNumber[] = [
  { id: "fr-1", number: "+33 6 12 34 56 78", country: "france", isAvailable: true, lastActive: new Date().toISOString() },
  { id: "fr-2", number: "+33 6 98 76 54 32", country: "france", isAvailable: true, lastActive: new Date().toISOString() },
  { id: "fr-3", number: "+33 7 11 22 33 44", country: "france", isAvailable: true, lastActive: new Date().toISOString() },
  { id: "fr-4", number: "+33 6 55 66 77 88", country: "france", isAvailable: true, lastActive: new Date().toISOString() },
  { id: "fr-5", number: "+33 7 99 88 77 66", country: "france", isAvailable: true, lastActive: new Date().toISOString() },
  { id: "fr-6", number: "+33 6 44 33 22 11", country: "france", isAvailable: true, lastActive: new Date().toISOString() },
];

const usaNumbers: PhoneNumber[] = [
  { id: "us-1", number: "+1 (555) 123-4567", country: "usa", isAvailable: true, lastActive: new Date().toISOString() },
  { id: "us-2", number: "+1 (555) 987-6543", country: "usa", isAvailable: true, lastActive: new Date().toISOString() },
  { id: "us-3", number: "+1 (555) 246-8135", country: "usa", isAvailable: true, lastActive: new Date().toISOString() },
  { id: "us-4", number: "+1 (555) 369-2580", country: "usa", isAvailable: true, lastActive: new Date().toISOString() },
  { id: "us-5", number: "+1 (555) 741-8520", country: "usa", isAvailable: true, lastActive: new Date().toISOString() },
  { id: "us-6", number: "+1 (555) 852-9630", country: "usa", isAvailable: true, lastActive: new Date().toISOString() },
];

const allNumbers = [...frenchNumbers, ...usaNumbers];

const sampleMessages: SmsMessage[] = [
  {
    id: "msg-1",
    phoneNumberId: "fr-1",
    sender: "+33 1 00 00 00 01",
    content: "Votre code de vérification est: 847291. Ne partagez ce code avec personne.",
    receivedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
  },
  {
    id: "msg-2",
    phoneNumberId: "fr-1",
    sender: "+33 1 00 00 00 02",
    content: "Bienvenue! Votre compte a été créé avec succès. Code: 123456",
    receivedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
  {
    id: "msg-3",
    phoneNumberId: "fr-2",
    sender: "AMAZON",
    content: "Votre code Amazon est 582614. Ne le partagez avec personne.",
    receivedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: "msg-4",
    phoneNumberId: "us-1",
    sender: "+1 (800) 555-0199",
    content: "Your verification code is: 934721. This code expires in 10 minutes.",
    receivedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
  },
  {
    id: "msg-5",
    phoneNumberId: "us-1",
    sender: "GOOGLE",
    content: "G-582914 is your Google verification code.",
    receivedAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
  },
  {
    id: "msg-6",
    phoneNumberId: "us-2",
    sender: "UBER",
    content: "Your Uber code is 7482. Never share this code.",
    receivedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  },
];

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private phoneNumbers: Map<string, PhoneNumber>;
  private messages: Map<string, SmsMessage>;

  constructor() {
    this.users = new Map();
    this.phoneNumbers = new Map();
    this.messages = new Map();

    allNumbers.forEach((num) => this.phoneNumbers.set(num.id, num));
    sampleMessages.forEach((msg) => this.messages.set(msg.id, msg));
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getPhoneNumbers(country: Country): Promise<PhoneNumber[]> {
    return Array.from(this.phoneNumbers.values()).filter(
      (num) => num.country === country && num.isAvailable
    );
  }

  async getPhoneNumber(id: string): Promise<PhoneNumber | undefined> {
    return this.phoneNumbers.get(id);
  }

  async getMessages(phoneNumberId: string): Promise<SmsMessage[]> {
    return Array.from(this.messages.values())
      .filter((msg) => msg.phoneNumberId === phoneNumberId)
      .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
  }
}

export const storage = new MemStorage();
