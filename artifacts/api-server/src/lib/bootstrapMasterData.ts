import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, vehicleBrandsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

const scriptsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../scripts",
);

function runScript(script: string, label: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("pnpm", ["exec", "tsx", script], {
      cwd: scriptsDir,
      shell: true,
      stdio: "inherit",
      env: process.env,
    });
    child.on("error", reject);
    child.on("exit", code => {
      if (code === 0) resolve();
      else reject(new Error(`${label} exited with code ${code}`));
    });
  });
}

/** Auto-seed India vehicle master data on first boot when the brands table is empty. */
export async function bootstrapMasterDataIfEmpty(): Promise<void> {
  try {
    const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(vehicleBrandsTable);
    const count = Number(row?.count ?? 0);
    if (count > 0) {
      logger.info({ brandCount: count }, "Vehicle master data present");
      return;
    }

    logger.warn("Vehicle brands table empty — running master data seed…");
    await runScript("src/ensure-master-data.ts", "Master data seed");
    logger.info("Vehicle master data seed completed");
  } catch (err) {
    logger.error(
      { err },
      "Master data bootstrap failed — run manually: cd scripts && pnpm run seed:master-data",
    );
  }
}

/** Auto-seed DCMS daily cleaning plans when the plans table is empty. */
export async function bootstrapDcmsPlansIfEmpty(): Promise<void> {
  try {
    const { dcmsPlansTable } = await import("@workspace/db");
    const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(dcmsPlansTable);
    const count = Number(row?.count ?? 0);
    if (count > 0) {
      logger.info({ planCount: count }, "DCMS plans present");
      return;
    }

    logger.warn("DCMS plans table empty — running plan seed…");
    await runScript("src/ensure-dcms-plans.ts", "DCMS plan seed");
    logger.info("DCMS plan seed completed");
  } catch (err) {
    logger.error(
      { err },
      "DCMS plan bootstrap failed — run manually: cd scripts && pnpm exec tsx src/ensure-dcms-plans.ts",
    );
  }
}
