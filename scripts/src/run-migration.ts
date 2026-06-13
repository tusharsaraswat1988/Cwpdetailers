import "./load-env.js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const migrationFile = process.argv[2] ?? "008_service_catalog.sql";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sqlPath = path.join(root, "lib/db/migrations", migrationFile);

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Add it to .env");
  }

  const { pool } = await import("@workspace/db");
  const sql = readFileSync(sqlPath, "utf8");
  console.log(`Applying migration: ${migrationFile}`);

  try {
    await pool.query(sql);
    console.log(`Migration ${migrationFile} applied successfully.`);
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
