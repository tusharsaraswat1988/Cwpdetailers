import { unlinkSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

for (const lockfile of ["package-lock.json", "yarn.lock"]) {
  const file = path.join(root, lockfile);
  if (existsSync(file)) {
    try {
      unlinkSync(file);
    } catch {
      // ignore if another process holds the file
    }
  }
}

const agent = process.env.npm_config_user_agent ?? "";
if (!agent.startsWith("pnpm/")) {
  console.error("Use pnpm instead of npm or yarn.");
  process.exit(1);
}
