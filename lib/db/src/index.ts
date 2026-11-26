import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const poolMax = process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX, 10) : 30;
const idleTimeoutMillis = process.env.DB_IDLE_TIMEOUT_MS ? parseInt(process.env.DB_IDLE_TIMEOUT_MS, 10) : 30000;
const connectionTimeoutMillis = process.env.DB_CONNECTION_TIMEOUT_MS ? parseInt(process.env.DB_CONNECTION_TIMEOUT_MS, 10) : 5000;
const statementTimeout = process.env.DB_STATEMENT_TIMEOUT_MS ? parseInt(process.env.DB_STATEMENT_TIMEOUT_MS, 10) : 10000;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: poolMax,
  idleTimeoutMillis,
  connectionTimeoutMillis,
  statement_timeout: statementTimeout,
});
pool.on("error", (err) => {
  console.warn("Unexpected idle client error in PostgreSQL pool:", err?.message || err);
});
pool.on("connect", (client) => {
  client.on("error", (err) => {
    console.warn("PostgreSQL client socket error:", err?.message || err);
  });
});
export const db = drizzle(pool, { schema });

export * from "./schema";
export { schema, pg };
