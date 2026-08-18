import "./load-env.js";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PENDING_MIGRATIONS,
  filesThrough,
  inferBaselineFilename,
  isMigrationAlreadyApplied,
  type Queryable,
} from "./migration-state.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const migrationsDir = path.join(root, "lib/db/migrations");

const TRACKING_DDL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

async function recordedFiles(db: Queryable): Promise<Set<string>> {
  const { rows } = await db.query("SELECT filename FROM schema_migrations");
  return new Set(rows.map(r => String(r.filename)));
}

async function recordApplied(db: Queryable, filename: string) {
  await db.query(
    `INSERT INTO schema_migrations (filename) VALUES ('${filename.replace(/'/g, "''")}') ON CONFLICT (filename) DO NOTHING`,
  );
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Add it to .env");
  }

  const { pool } = await import("@workspace/db");
  const db = pool as unknown as Queryable;
  const available = new Set(readdirSync(migrationsDir));

  try {
    await db.query(TRACKING_DDL);
    let recorded = await recordedFiles(db);

    if (recorded.size === 0) {
      const baseline = await inferBaselineFilename(db);
      if (baseline) {
        const already = filesThrough(PENDING_MIGRATIONS, baseline);
        console.log(`Tracking empty — recording ${already.length} already-applied files through ${baseline}.`);
        for (const file of already) {
          await recordApplied(db, file);
        }
        recorded = await recordedFiles(db);
      }
    }

    for (const file of PENDING_MIGRATIONS) {
      if (!available.has(file)) {
        console.warn(`Skip missing migration: ${file}`);
        continue;
      }
      if (recorded.has(file)) {
        console.log(`Skip ${file} (already recorded)`);
        continue;
      }
      if (await isMigrationAlreadyApplied(db, file)) {
        await recordApplied(db, file);
        console.log(`Skip ${file} (already applied in schema)`);
        continue;
      }

      const sql = readFileSync(path.join(migrationsDir, file), "utf8");
      console.log(`Applying ${file}…`);
      await db.query(sql);
      await recordApplied(db, file);
      recorded.add(file);
      console.log(`  ✓ ${file}`);
    }
    console.log("All pending migrations applied.");
  } finally {
    await pool.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
