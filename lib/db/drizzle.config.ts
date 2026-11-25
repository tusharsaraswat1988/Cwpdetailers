import { defineConfig } from "drizzle-kit";
import { loadRepoEnv } from "../env/load-env.mjs";

loadRepoEnv(import.meta.url);

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: "./src/schema/*.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
