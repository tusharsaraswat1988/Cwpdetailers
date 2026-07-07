import { db, usersTable, authOtpCodesTable } from "@workspace/db";
import { eq, and, gt, isNull, desc } from "drizzle-orm";
import { sendOtpSms, isOtpSmsConfigured } from "./dltSms";
import { generateOtpCode, hashOtpCode, maskPhone } from "./googleAuth";
import type { AuthOtpPurpose } from "@workspace/db";

const OTP_TTL_MINUTES = 15;
const MAX_OTP_PER_HOUR = 5;

type AuthPortal = "customer" | "staff";

function otpExpiry(): Date {
  return new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
}

async function countRecentOtps(phone: string, purpose: AuthOtpPurpose): Promise<number> {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const rows = await db
    .select({ id: authOtpCodesTable.id })
    .from(authOtpCodesTable)
    .where(
      and(
        eq(authOtpCodesTable.phone, phone),
        eq(authOtpCodesTable.purpose, purpose),
        gt(authOtpCodesTable.createdAt, since),
      ),
    );
  return rows.length;
}

async function invalidatePendingCodes(phone: string, purpose: AuthOtpPurpose) {
  await db
    .update(authOtpCodesTable)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(authOtpCodesTable.phone, phone),
        eq(authOtpCodesTable.purpose, purpose),
        isNull(authOtpCodesTable.usedAt),
      ),
    );
}

export async function sendAuthOtp(params: {
  phone: string;
  purpose: AuthOtpPurpose;
  portal?: AuthPortal;
  name?: string;
}): Promise<{ sentSms: boolean; maskedPhone: string }> {
  if (!isOtpSmsConfigured()) {
    throw new Error("SMS OTP is not configured. Contact support.");
  }

  const portal = params.portal ?? "customer";
  if (portal !== "customer") {
    throw new Error("OTP sign-in is only available for customers");
  }

  const phone = params.phone;
  const existingUser = (
    await db.select().from(usersTable).where(eq(usersTable.phone, phone)).limit(1)
  )[0];

  if (params.purpose === "login") {
    if (!existingUser) {
      throw new Error("No account found for this phone number. Please sign up first.");
    }
    if (!existingUser.isActive) {
      throw new Error("Account suspended. Contact support.");
    }
    if (existingUser.role !== "customer") {
      throw new Error("This phone number is not registered as a customer account.");
    }
  }

  if (params.purpose === "signup") {
    if (existingUser) {
      throw new Error("This phone number is already registered. Sign in instead.");
    }
    const trimmedName = params.name?.trim();
    if (!trimmedName) {
      throw new Error("Name is required for sign up");
    }
  }

  if (await countRecentOtps(phone, params.purpose) >= MAX_OTP_PER_HOUR) {
    throw new Error("Too many OTP requests. Please try again after an hour.");
  }

  await invalidatePendingCodes(phone, params.purpose);

  const code = generateOtpCode();
  const codeHash = hashOtpCode(code);
  const recipientName =
    params.purpose === "login"
      ? (existingUser?.name ?? "Customer")
      : (params.name?.trim() ?? "Customer");

  await db.insert(authOtpCodesTable).values({
    phone,
    codeHash,
    purpose: params.purpose,
    portal,
    pendingName: params.purpose === "signup" ? recipientName : null,
    expiresAt: otpExpiry(),
  });

  const smsResult = await sendOtpSms({
    phone,
    recipientName,
    otpCode: code,
    otpExpiryMinutes: OTP_TTL_MINUTES,
  });

  if (!smsResult.success) {
    throw new Error(smsResult.error ?? "Could not send OTP SMS");
  }

  return {
    sentSms: true,
    maskedPhone: maskPhone(phone),
  };
}

export async function verifyAuthOtp(params: {
  phone: string;
  code: string;
  purpose: AuthOtpPurpose;
  portal?: AuthPortal;
}): Promise<{ ok: true; pendingName?: string | null } | { ok: false }> {
  const portal = params.portal ?? "customer";
  const codeHash = hashOtpCode(params.code);
  const now = new Date();

  const rows = await db
    .select()
    .from(authOtpCodesTable)
    .where(
      and(
        eq(authOtpCodesTable.phone, params.phone),
        eq(authOtpCodesTable.purpose, params.purpose),
        eq(authOtpCodesTable.portal, portal),
        eq(authOtpCodesTable.codeHash, codeHash),
        isNull(authOtpCodesTable.usedAt),
        gt(authOtpCodesTable.expiresAt, now),
      ),
    )
    .orderBy(desc(authOtpCodesTable.createdAt))
    .limit(1);

  const row = rows[0];
  if (!row) return { ok: false };

  await db
    .update(authOtpCodesTable)
    .set({ usedAt: now })
    .where(eq(authOtpCodesTable.id, row.id));

  return { ok: true, pendingName: row.pendingName };
}

export { isOtpSmsConfigured, OTP_TTL_MINUTES };
