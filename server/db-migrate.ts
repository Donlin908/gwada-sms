/**
 * Migrations SQL idempotentes — exécutées au démarrage du serveur.
 * Chaque instruction utilise IF NOT EXISTS / IF EXISTS pour être safe
 * sur une base de données déjà partiellement migrée.
 */
import { db } from "./db";
import { sql } from "drizzle-orm";

const MIGRATIONS: Array<{ name: string; sql: string }> = [
  {
    name: "add_provider_to_phone_numbers",
    sql: `ALTER TABLE phone_numbers
          ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'twilio'`,
  },
];

export async function runStartupMigrations(): Promise<void> {
  for (const migration of MIGRATIONS) {
    try {
      await db.execute(sql.raw(migration.sql));
      console.log(`[Migration] ✅ ${migration.name}`);
    } catch (err: any) {
      // Certains drivers remontent une erreur même avec IF NOT EXISTS — on logge et on continue
      console.warn(`[Migration] ⚠️  ${migration.name} : ${err.message}`);
    }
  }
}
