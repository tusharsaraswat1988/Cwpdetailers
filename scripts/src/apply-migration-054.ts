import "./load-env.js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function main() {
  const { pool } = await import("@workspace/db");
  const sql = readFileSync(
    path.join(root, "lib/db/migrations/054_job_orchestration_phase55.sql"),
    "utf8",
  );
  await pool.query(sql);
  console.log("Applied 054_job_orchestration_phase55.sql");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
