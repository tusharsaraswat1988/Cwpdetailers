import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
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
export { schema };
