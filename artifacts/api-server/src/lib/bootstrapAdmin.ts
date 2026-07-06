import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "./passwords";
import { parseRequiredMobile, parseOptionalEmail } from "./contactFields";
import { logger } from "./logger";

const ADMIN_ROLES = new Set(["admin", "superadmin", "manager"]);

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

async function resolveBootstrapTarget(config: AdminEnvConfig): Promise<{
  existingId?: number;
  email: string | null;
}> {
  const byPhone = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.phone, config.phone))
    .limit(1);
  if (byPhone[0]) {
    return { existingId: byPhone[0].id, email: config.email };
  }

  if (!config.email) {
    return { email: null };
  }

  const byEmail = await db
    .select({ id: usersTable.id, role: usersTable.role, phone: usersTable.phone })
    .from(usersTable)
    .where(eq(usersTable.email, config.email))
    .limit(1);

  if (byEmail[0]) {
    if (ADMIN_ROLES.has(byEmail[0].role)) {
      return { existingId: byEmail[0].id, email: config.email };
    }
    logger.warn(
      {
        email: config.email,
        existingPhone: byEmail[0].phone,
        existingRole: byEmail[0].role,
      },
      "ADMIN_EMAIL already used by a non-admin account — super admin will sync without that email",
    );
    return { email: null };
  }

  return { email: config.email };
}

/** Ensures the super-admin account exists and matches .env credentials (idempotent). */
export async function bootstrapAdminFromEnv(): Promise<void> {
  const config = readAdminEnvConfig();
  if (!config) {
    logger.info("ADMIN_PHONE / ADMIN_PASSWORD not set — skipping super admin bootstrap");
    return;
  }

  const passwordHash = await hashPassword(config.password);
  const target = await resolveBootstrapTarget(config);

  if (target.existingId) {
    await db
      .update(usersTable)
      .set({
        name: config.name,
        phone: config.phone,
        email: target.email,
        passwordHash,
        role: "superadmin",
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, target.existingId));
    logger.info({ phone: config.phone }, "Super admin synced from env");
    return;
  }

  await db.insert(usersTable).values({
    name: config.name,
    phone: config.phone,
    email: target.email,
    passwordHash,
    role: "superadmin",
    isActive: true,
  });
  logger.info({ phone: config.phone }, "Super admin created from env");
}
