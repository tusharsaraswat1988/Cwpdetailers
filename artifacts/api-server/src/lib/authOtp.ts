import { db, authOtpCodesTable } from "@workspace/db";
import { eq, and, gt, isNull } from "drizzle-orm";
import { sendOtpSms, isOtpSmsConfigured } from "./dltSms";
import { generateOtpCode, hashOtpCode, maskPhone } from "./googleAuth";
import {
  AuthError,
  resolveCustomerIdentityByPhone,
  normalizeIndianMobile,
} from "./authIdentity";
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
    throw new AuthError(
      "OTP_PROVIDER_UNAVAILABLE",
      503,
      "Verification is temporarily unavailable. Please try again later.",
      "SMS OTP is not configured. Missing FAST2SMS_DLT_MESSAGE_ID or FAST2SMS_OTP_ID",
    );
  }

  const portal = params.portal ?? "customer";
  if (portal !== "customer") {
    throw new AuthError("PORTAL_MISMATCH", 403, "OTP sign-in is only available for customers");
  }

  const normalized = normalizeIndianMobile(params.phone);
  if (!normalized) {
    throw new AuthError("ACCOUNT_NOT_ELIGIBLE", 400, "Please enter a valid 10-digit mobile number.");
  }

  // Shared canonical resolution
  const resolved = await resolveCustomerIdentityByPhone(normalized);

  if (params.purpose === "login") {
    if (resolved.status === "NOT_FOUND") {
      throw new AuthError("ACCOUNT_NOT_ELIGIBLE", 404, "No account found for this phone number. Please sign up first.");
    }
    if (resolved.status === "INELIGIBLE_ROLE") {
      throw new AuthError("PORTAL_MISMATCH", 403, resolved.reason);
    }
    if (resolved.status === "INELIGIBLE_SUSPENDED") {
      throw new AuthError("ACCOUNT_NOT_ELIGIBLE", 401, resolved.reason);
    }
  }

  if (params.purpose === "signup") {
    if (resolved.status === "ELIGIBLE_USER" || resolved.status === "ELIGIBLE_CUSTOMER_WITHOUT_USER") {
      throw new AuthError("ACCOUNT_NOT_ELIGIBLE", 409, "This phone number is already registered. Sign in instead.");
    }
    if (resolved.status === "INELIGIBLE_ROLE") {
      throw new AuthError("PORTAL_MISMATCH", 403, resolved.reason);
    }
    const trimmedName = params.name?.trim();
    if (!trimmedName) {
      throw new AuthError("ACCOUNT_NOT_ELIGIBLE", 400, "Name is required for sign up");
    }
  }

  if (await countRecentOtps(normalized, params.purpose) >= MAX_OTP_PER_HOUR) {
    throw new AuthError("OTP_RATE_LIMITED", 429, "Too many attempts. Please wait and try again.");
  }

  await invalidatePendingCodes(normalized, params.purpose);

  const code = generateOtpCode();
  const codeHash = hashOtpCode(code);
  const recipientName =
    params.purpose === "login"
      ? (resolved.status === "ELIGIBLE_USER"
          ? resolved.user.name
          : resolved.status === "ELIGIBLE_CUSTOMER_WITHOUT_USER"
            ? resolved.customer.name
            : "Customer")
      : (params.name?.trim() ?? "Customer");

  const [otpRow] = await db
    .insert(authOtpCodesTable)
    .values({
      phone: normalized,
      codeHash,
      purpose: params.purpose,
      portal,
      pendingName: params.purpose === "signup" ? recipientName : null,
      expiresAt: otpExpiry(),
    })
    .returning();

  const smsResult = await sendOtpSms({
    phone: normalized,
    recipientName,
    otpCode: code,
    otpExpiryMinutes: OTP_TTL_MINUTES,
  });

  if (!smsResult.success) {
    // Clean up failed pending code safely so an orphaned OTP record is not left pending
    if (otpRow) {
      await db.delete(authOtpCodesTable).where(eq(authOtpCodesTable.id, otpRow.id));
    }
    throw new AuthError(
      "OTP_DELIVERY_FAILED",
      502,
      "Unable to send verification code. Please try again in a few moments.",
      smsResult.error ?? "Could not send OTP SMS",
    );
  }

  return {
    sentSms: true,
    maskedPhone: maskPhone(normalized),
  };
}

export async function verifyAuthOtp(params: {
  phone: string;
  code: string;
  purpose: AuthOtpPurpose;
  portal?: AuthPortal;
}): Promise<{ ok: true; pendingName?: string | null } | { ok: false; reason?: string }> {
  const portal = params.portal ?? "customer";
  const normalized = normalizeIndianMobile(params.phone) ?? params.phone;
  const codeHash = hashOtpCode(params.code.trim());
  const now = new Date();

  // Atomic consumption ensures OTP cannot be verified twice under concurrent requests
  const [consumed] = await db
    .update(authOtpCodesTable)
    .set({ usedAt: now })
    .where(
      and(
        eq(authOtpCodesTable.phone, normalized),
        eq(authOtpCodesTable.purpose, params.purpose),
        eq(authOtpCodesTable.portal, portal),
        eq(authOtpCodesTable.codeHash, codeHash),
        isNull(authOtpCodesTable.usedAt),
        gt(authOtpCodesTable.expiresAt, now),
      ),
    )
    .returning();

  if (!consumed) return { ok: false, reason: "OTP_INVALID_OR_EXPIRED" };

  return { ok: true, pendingName: consumed.pendingName };
}

export { isOtpSmsConfigured, OTP_TTL_MINUTES };
