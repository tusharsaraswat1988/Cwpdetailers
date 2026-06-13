import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "./passwords";
import { parseRequiredMobile, parseOptionalEmail } from "./contactFields";
import { logger } from "./logger";

export type AdminEnvConfig = {
  phone: string;
  password: string;
  name: string;
  email: string | null;
};

/** Reads super-admin bootstrap credentials from ADMIN_PHONE + ADMIN_PASSWORD. */
export function readAdminEnvConfig(): AdminEnvConfig | null {
  const phoneRaw = process.env.ADMIN_PHONE?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!phoneRaw || !password) return null;

  const phoneResult = parseRequiredMobile(phoneRaw, "ADMIN_PHONE");
  if (!phoneResult.ok) {
    logger.warn({ error: phoneResult.error }, "Invalid ADMIN_PHONE — skipping admin bootstrap");
    return null;
  }

  const emailRaw = process.env.ADMIN_EMAIL?.trim() || "admin@cwpdetailers.com";
  const emailResult = parseOptionalEmail(emailRaw);

  return {
    phone: phoneResult.value,
    password,
    name: process.env.ADMIN_NAME?.trim() || "Super Admin",
    email: emailResult.ok ? emailResult.value : null,
  };
}

/** Ensures the super-admin account exists and matches .env credentials (idempotent). */
export async function bootstrapAdminFromEnv(): Promise<void> {
  const config = readAdminEnvConfig();
  if (!config) {
    logger.info("ADMIN_PHONE / ADMIN_PASSWORD not set — skipping super admin bootstrap");
    return;
  }

  const passwordHash = await hashPassword(config.password);
  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.phone, config.phone))
    .limit(1);

  if (existing[0]) {
    await db
      .update(usersTable)
      .set({
        name: config.name,
        email: config.email,
        passwordHash,
        role: "superadmin",
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, existing[0].id));
    logger.info({ phone: config.phone }, "Super admin synced from env");
    return;
  }

  await db.insert(usersTable).values({
    name: config.name,
    phone: config.phone,
    email: config.email,
    passwordHash,
    role: "superadmin",
    isActive: true,
  });
  logger.info({ phone: config.phone }, "Super admin created from env");
}
