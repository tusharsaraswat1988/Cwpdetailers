import "./load-env.js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "@workspace/db";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const file = process.argv[2] ?? "040_backfill_assignment_tenant.sql";
const sql = readFileSync(path.join(root, "lib/db/migrations", file), "utf8");

await pool.query(sql);
console.log(`Applied ${file}`);
await pool.end();
