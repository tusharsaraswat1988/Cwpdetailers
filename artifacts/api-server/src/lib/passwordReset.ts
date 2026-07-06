import { db, passwordResetCodesTable, sessionsTable } from "@workspace/db";
import { eq, and, gt, isNull, desc } from "drizzle-orm";
import { sendViaProvider } from "./communications/providerRegistry";
import { getBrandName } from "./brandIdentityService";
import {
  generateOtpCode,
  hashOtpCode,
  hashOpaqueToken,
  maskEmail,
  maskPhone,
} from "./googleAuth";

const OTP_TTL_MINUTES = 15;
const MAX_OTP_PER_HOUR = 5;

type AuthPortal = "customer" | "staff";

function otpExpiry(): Date {
  return new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
}

async function countRecentOtps(userId: number): Promise<number> {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const rows = await db
    .select({ id: passwordResetCodesTable.id })
    .from(passwordResetCodesTable)
    .where(
      and(
        eq(passwordResetCodesTable.userId, userId),
        gt(passwordResetCodesTable.createdAt, since),
      ),
    );
  return rows.length;
}

async function invalidatePendingCodes(userId: number) {
  await db
    .update(passwordResetCodesTable)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(passwordResetCodesTable.userId, userId),
        isNull(passwordResetCodesTable.usedAt),
      ),
    );
}

export async function sendPasswordResetOtp(
  user: { id: number; phone: string; email?: string | null; name: string },
  portal: AuthPortal,
): Promise<{ sentSms: boolean; sentEmail: boolean; maskedPhone: string; maskedEmail: string | null }> {
  if (await countRecentOtps(user.id) >= MAX_OTP_PER_HOUR) {
    throw new Error("Too many reset attempts. Please try again after an hour or contact support.");
  }

  await invalidatePendingCodes(user.id);

  const code = generateOtpCode();
  const codeHash = hashOtpCode(code);
  const brandName = await getBrandName();

  await db.insert(passwordResetCodesTable).values({
    userId: user.id,
    codeHash,
    channel: user.email ? "both" : "sms",
    portal,
    expiresAt: otpExpiry(),
  });

  const smsMessage = `${brandName}: Your password reset code is ${code}. Valid for ${OTP_TTL_MINUTES} minutes. Do not share this code.`;
  const emailHtml = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="color:#111;">Password Reset</h2>
      <p>Hi ${user.name},</p>
      <p>Use this code to reset your ${portal === "staff" ? "staff portal" : "account"} password:</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:4px;color:#c9a227;">${code}</p>
      <p style="color:#666;font-size:14px;">This code expires in ${OTP_TTL_MINUTES} minutes. If you didn't request this, ignore this email.</p>
      <p style="color:#999;font-size:12px;">— ${brandName} Support</p>
    </div>`;

  let sentSms = false;
  let sentEmail = false;

  const smsResult = await sendViaProvider("sms", {
    phone: user.phone,
    message: smsMessage,
  });
  sentSms = smsResult.success;

  if (user.email) {
    const emailResult = await sendViaProvider("email", {
      email: user.email,
      subject: `${brandName} — Password Reset Code`,
      message: emailHtml,
    });
    sentEmail = emailResult.success;
  }

  if (!sentSms && !sentEmail) {
    throw new Error("Could not send reset code. Please contact support.");
  }

  return {
    sentSms,
    sentEmail,
    maskedPhone: maskPhone(user.phone),
    maskedEmail: user.email ? maskEmail(user.email) : null,
  };
}

export async function verifyPasswordResetOtp(
  userId: number,
  code: string,
  portal: AuthPortal,
): Promise<boolean> {
  const codeHash = hashOtpCode(code);
  const now = new Date();

  const rows = await db
    .select()
    .from(passwordResetCodesTable)
    .where(
      and(
        eq(passwordResetCodesTable.userId, userId),
        eq(passwordResetCodesTable.codeHash, codeHash),
        eq(passwordResetCodesTable.portal, portal),
        isNull(passwordResetCodesTable.usedAt),
        gt(passwordResetCodesTable.expiresAt, now),
      ),
    )
    .orderBy(desc(passwordResetCodesTable.createdAt))
    .limit(1);

  const row = rows[0];
  if (!row) return false;

  await db
    .update(passwordResetCodesTable)
    .set({ usedAt: now })
    .where(eq(passwordResetCodesTable.id, row.id));

  return true;
}

export async function revokeAllUserSessions(userId: number) {
  await db
    .update(sessionsTable)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(sessionsTable.userId, userId),
        isNull(sessionsTable.revokedAt),
      ),
    );
}

export { hashOpaqueToken };
