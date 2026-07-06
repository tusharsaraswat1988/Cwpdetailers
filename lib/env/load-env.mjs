import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Walk up from startDir until a `.env` file is found (max 8 levels). */
export function findEnvFile(startDir) {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 8; i++) {
    const file = path.join(dir, ".env");
    if (existsSync(file)) return file;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * Parse and apply `.env` values.
 * - Skips blank values and comments
 * - Last non-empty assignment wins for duplicate keys
 * - Does not override existing non-empty process.env by default
 */
export function loadEnvFile(file, { override = false } = {}) {
  if (!file || !existsSync(file)) return false;

  const values = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (val === "") continue;
    values[key] = val;
  }

  for (const [key, val] of Object.entries(values)) {
    // DATABASE_URL must always come from repo .env when present (local dev).
    const preferFile =
      key === "DATABASE_URL"
      || override
      || process.env.NODE_ENV !== "production"
      || !process.env[key]
      || process.env[key] === "";
    if (preferFile) process.env[key] = val;
  }

  return true;
}

/** Load repo-root `.env` starting from the directory of import.meta.url. */
export function loadRepoEnv(fromImportMetaUrl) {
  const startDir = path.dirname(fileURLToPath(fromImportMetaUrl));
  const file = findEnvFile(startDir);
  return loadEnvFile(file, { override: false });
}
