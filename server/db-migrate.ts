/**
 * Migrations SQL idempotentes — exécutées au démarrage du serveur.
 * Chaque migration tente l'ALTER TABLE puis vérifie que la colonne
 * existe réellement. Si la vérification échoue, le processus plante
 * (fail-fast) plutôt que de laisser un monitoring bogué tourner.
 */
import { db } from "./db";
import { sql } from "drizzle-orm";

interface Migration {
  name: string;
  sql: string;
  /** Requête de vérification post-migration : doit retourner au moins une ligne. */
  verify: string;
}

const MIGRATIONS: Migration[] = [
  {
    name: "add_provider_to_phone_numbers",
    sql: `ALTER TABLE phone_numbers
          ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'twilio'`,
    verify: `SELECT column_name FROM information_schema.columns
             WHERE table_name = 'phone_numbers' AND column_name = 'provider'`,
  },
];

export async function runStartupMigrations(): Promise<void> {
  for (const migration of MIGRATIONS) {
    // 1. Tentative d'application
    try {
      await db.execute(sql.raw(migration.sql));
    } catch (err: any) {
      // Certains drivers remontent une erreur même si la colonne existe déjà —
      // on vérifie directement plutôt que de supposer.
      console.warn(`[Migration] ALTER TABLE a retourné une erreur : ${err.message} — vérification...`);
    }

    // 2. Vérification post-migration (fail-fast si absent)
    try {
      const rows = await db.execute(sql.raw(migration.verify)) as any;
      const count = Array.isArray(rows) ? rows.length : (rows?.rows?.length ?? 0);
      if (count === 0) {
        throw new Error(
          `[Migration] ❌ ${migration.name} : colonne absente après migration. ` +
          `Vérifiez les droits ALTER TABLE du rôle PostgreSQL ou appliquez manuellement : ${migration.sql}`
        );
      }
      console.log(`[Migration] ✅ ${migration.name}`);
    } catch (verifyErr: any) {
      // Si c'est notre propre erreur (count=0), la relancer directement
      if (verifyErr.message.startsWith("[Migration] ❌")) throw verifyErr;
      // Sinon c'est un problème de connexion — également fatal
      throw new Error(`[Migration] ❌ ${migration.name} : vérification impossible (${verifyErr.message})`);
    }
  }
}
