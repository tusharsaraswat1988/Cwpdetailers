import { Router } from "express";
import crypto from "crypto";
import {
  db,
  usersTable,
  customersTable,
  sessionsTable,
  authPendingGoogleTable,
} from "@workspace/db";
import { eq, and, gt, or, isNull, sql } from "drizzle-orm";
import { generateToken, hashToken, optionalAuth, requireAuth, getRolePermissions } from "../middlewares/auth";
import { hashPassword, verifyPasswordWithUpgrade } from "../lib/passwords";
import {
  normalizeLoginIdentifier,
  parseRequiredMobile,
  parseRequiredEmail,
  parseOptionalEmail,
} from "../lib/contactFields";
import { assertContactIdentityAvailable } from "../lib/contactIdentity";
import {
  verifyGoogleIdToken,
  getGoogleClientId,
  generateOpaqueToken,
  hashOpaqueToken,
} from "../lib/googleAuth";
import {
  sendPasswordResetOtp,
  verifyPasswordResetOtp,
  revokeAllUserSessions,
} from "../lib/passwordReset";
import {
  setSessionCookie,
  clearSessionCookie,
  clearAllSessionCookies,
  listSessionTokens,
  parseAuthPortalHeader,
} from "../lib/sessionCookie";
import {
  type AuthPortal,
  isAuthPortal,
  isRoleAllowedForPortal,
  portalMismatchMessage,
} from "../lib/authPortals";
import {
  authProviderAfterPasswordSet,
  userHasPassword,
  validateNewPassword,
} from "../lib/userPassword";
import { sendAuthOtp, verifyAuthOtp, isOtpSmsConfigured } from "../lib/authOtp";
import { authRateLimit } from "../lib/authRateLimit";
import { logAuthEvent, neutralizeOtpSendError } from "../lib/authObservability";
import { normalizeStaffPasswordLogin } from "../lib/staffLoginSync";
import {
  findCustomerByEmail,
  findCustomerForGooglePhoneLink,
  linkGoogleAuthToExistingCustomer,
  assertGooglePhoneOkForCustomerSignup,
  assertGoogleEmailOkForCustomerSignup,
} from "../lib/googleCustomerLink";
import { ensureCustomerLoginUser } from "../lib/customerAccount";
import { findUserByLoginIdentifier } from "../lib/userLookup";
import {
  AuthError,
  resolveOrRepairVerifiedCustomer,
  type StructuredAuthErrorCode,
} from "../lib/authIdentity";
import type { AuthOtpPurpose } from "@workspace/db";

const router = Router();

const SESSION_TTL_DAYS = 30;
const GOOGLE_LINK_TTL_MINUTES = 15;

function getRequestId(req: { id?: unknown; headers: Record<string, unknown> }): string {
  const raw = req.id ?? req.headers["x-request-id"] ?? req.headers["x-correlation-id"];
  return typeof raw === "string" && raw.trim() ? raw.trim() : crypto.randomUUID();
}

function parsePasswordPortal(raw: unknown): AuthPortal {
  if (raw === "staff") return "staff";
  if (raw === "admin") return "admin";
  return "customer";
}

async function issueSession(userId: number, req: { headers: Record<string, unknown>; ip?: string }) {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessionsTable).values({
    userId,
    tokenHash,
    userAgent: String(req.headers["user-agent"] ?? ""),
    ipAddress: req.ip ?? null,
    expiresAt,
  });
  return token;
}

function toSafeUser(u: typeof usersTable.$inferSelect) {
  const { passwordHash: _, ...safeUser } = u;
  return {
    ...safeUser,
    hasUserPassword: userHasPassword(u),
  };
}

/** Remove half-finished Google customer sign-ups that block phone/email reuse. */
async function cleanupIncompleteGoogleCustomers(googleId: string, phone: string, email: string) {
  const matchConditions = [eq(usersTable.googleId, googleId), eq(usersTable.phone, phone)];
  if (email) matchConditions.push(eq(usersTable.email, email));

  const orphans = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(
      and(
        eq(usersTable.role, "customer"),
        isNull(usersTable.customerId),
        or(...matchConditions),
      ),
    );

  for (const { id } of orphans) {
    await db.delete(sessionsTable).where(eq(sessionsTable.userId, id));
    await db.delete(usersTable).where(eq(usersTable.id, id));
  }
}

async function findUserByIdentifier(phone?: string, email?: string) {
  return findUserByLoginIdentifier(phone, email);
}

router.get("/auth/google/config", (_req, res) => {
  const clientId = getGoogleClientId();
  return res.json({
    enabled: Boolean(clientId),
    clientId: clientId ?? null,
  });
});

router.post("/auth/google", async (req, res) => {
  const requestId = getRequestId(req);
  res.setHeader("X-Correlation-Id", requestId);
  try {
    const { idToken, portal: rawPortal = "customer" } = req.body as { idToken?: string; portal?: string };
    if (!idToken) {
      return res.status(400).json({ error: "Google token required", code: "ACCOUNT_NOT_ELIGIBLE", requestId });
    }
    if (rawPortal === "staff") {
      return res.status(400).json({
        error: "Google sign-in is not available for the staff portal. Use your phone number and admin-provided password.",
        code: "PORTAL_MISMATCH",
        requestId,
      });
    }
    const portal = "customer" as const;

    const googleProfile = await verifyGoogleIdToken(idToken);
    const normalizedEmail = googleProfile.email.toLowerCase().trim();

    let user = (
      await db.select().from(usersTable).where(eq(usersTable.googleId, googleProfile.sub)).limit(1)
    )[0];

    if (!user && normalizedEmail) {
      const emailUsers = await db
        .select()
        .from(usersTable)
        .where(
          and(
            sql`${usersTable.email} IS NOT NULL`,
            sql`TRIM(${usersTable.email}) <> ''`,
            sql`LOWER(TRIM(${usersTable.email})) = ${normalizedEmail}`,
          ),
        );

      const nonCustomer = emailUsers.find(u => !isRoleAllowedForPortal(u.role, portal));
      if (nonCustomer) {
        if (nonCustomer.role === "staff") {
          return res.status(403).json({
            error:
              "This Google account belongs to a staff member. Use the Staff portal with your phone number and password.",
            code: "PORTAL_MISMATCH",
            requestId,
          });
        }
        if (["admin", "superadmin", "manager"].includes(nonCustomer.role)) {
          return res.status(403).json({
            error:
              "This Google account belongs to an administrator. Use the Admin portal to sign in.",
            code: "PORTAL_MISMATCH",
            requestId,
          });
        }
        return res.status(403).json({
          error: portalMismatchMessage(portal),
          code: "PORTAL_MISMATCH",
          requestId,
        });
      }

      user = emailUsers.find(u => isRoleAllowedForPortal(u.role, portal));
    }

    if (!user && normalizedEmail && portal === "customer") {
      const customer = await findCustomerByEmail(normalizedEmail);
      if (customer) {
        if (customer.status !== "active") {
          return res.status(401).json({
            error: "Account suspended",
            code: "ACCOUNT_NOT_ELIGIBLE",
            requestId,
          });
        }
        user = await ensureCustomerLoginUser(customer, {
          googleId: googleProfile.sub,
          email: normalizedEmail,
          avatarUrl: googleProfile.picture ?? null,
          authProvider: "google",
          passwordHash: await hashPassword(generateOpaqueToken()),
        });
      }
    }

    if (user) {
      if (!isRoleAllowedForPortal(user.role, portal)) {
        if (user.role === "staff") {
          return res.status(403).json({
            error:
              "This Google account belongs to a staff member. Use the Staff portal with your phone number and password.",
            code: "PORTAL_MISMATCH",
            requestId,
          });
        }
        if (["admin", "superadmin", "manager"].includes(user.role)) {
          return res.status(403).json({
            error:
              "This Google account belongs to an administrator. Use the Admin portal to sign in.",
            code: "PORTAL_MISMATCH",
            requestId,
          });
        }
        return res.status(403).json({
          error: portalMismatchMessage(portal),
          code: "PORTAL_MISMATCH",
          requestId,
        });
      }
      if (!user.isActive) {
        return res.status(401).json({
          error: "Account suspended",
          code: "ACCOUNT_NOT_ELIGIBLE",
          requestId,
        });
      }

      const updates: Partial<typeof usersTable.$inferInsert> = {
        updatedAt: new Date(),
        googleId: user.googleId ?? googleProfile.sub,
        avatarUrl: googleProfile.picture ?? user.avatarUrl,
        authProvider: user.passwordHash ? user.authProvider : "google",
      };
      if (!user.email && normalizedEmail) updates.email = normalizedEmail;

      const [updated] = await db
        .update(usersTable)
        .set(updates)
        .where(eq(usersTable.id, user.id))
        .returning();
      user = updated ?? user;

      const token = await issueSession(user.id, req);
      setSessionCookie(res, token, portal);
      return res.json({ token, user: toSafeUser(user), requestId });
    }

    // No customer user yet — still block if this Google email is a staff or admin identity.
    const emailGuard = await assertGoogleEmailOkForCustomerSignup(normalizedEmail);
    if (!emailGuard.ok) {
      return res.status(emailGuard.status).json({ ...emailGuard.body, requestId });
    }

    const linkToken = generateOpaqueToken();
    const tokenHash = hashOpaqueToken(linkToken);
    const expiresAt = new Date(Date.now() + GOOGLE_LINK_TTL_MINUTES * 60 * 1000);

    await db.insert(authPendingGoogleTable).values({
      tokenHash,
      googleId: googleProfile.sub,
      email: normalizedEmail,
      name: googleProfile.name ?? normalizedEmail.split("@")[0] ?? "Customer",
      avatarUrl: googleProfile.picture ?? null,
      portal,
      expiresAt,
    });

    return res.status(202).json({
      needsPhone: true,
      linkToken,
      email: normalizedEmail,
      name: googleProfile.name ?? null,
      code: "GOOGLE_PHONE_LINK_REQUIRED",
      requestId,
    });
  } catch (err) {
    req.log.error({ err, requestId }, "Google auth error");
    const message = err instanceof Error ? err.message : "Google sign-in failed";
    return res.status(400).json({ error: message, code: "ACCOUNT_NOT_ELIGIBLE", requestId });
  }
});

router.post("/auth/google/complete", async (req, res) => {
  const requestId = getRequestId(req);
  res.setHeader("X-Correlation-Id", requestId);
  try {
    const { linkToken, phone, password: rawPassword } = req.body as {
      linkToken?: string;
      phone?: string;
      password?: string;
    };
    if (!linkToken) {
      return res.status(400).json({ error: "Link token required", code: "ACCOUNT_NOT_ELIGIBLE", requestId });
    }

    const phoneResult = parseRequiredMobile(phone);
    if (!phoneResult.ok) {
      return res.status(400).json({ error: phoneResult.error, code: "ACCOUNT_NOT_ELIGIBLE", requestId });
    }

    const pwCheck = validateNewPassword(rawPassword);
    if (!pwCheck.ok) {
      return res.status(400).json({ error: pwCheck.error, code: "ACCOUNT_NOT_ELIGIBLE", requestId });
    }
    const chosenPassword = pwCheck.value;

    const tokenHash = hashOpaqueToken(linkToken);
    const now = new Date();

    const pending = (
      await db
        .select()
        .from(authPendingGoogleTable)
        .where(
          and(
            eq(authPendingGoogleTable.tokenHash, tokenHash),
            gt(authPendingGoogleTable.expiresAt, now),
          ),
        )
        .limit(1)
    )[0];

    if (!pending) {
      return res.status(400).json({
        error: "Google sign-in session expired. Please try again.",
        code: "OTP_INVALID_OR_EXPIRED",
        requestId,
      });
    }

    const normalizedEmail = pending.email.toLowerCase().trim();
    await cleanupIncompleteGoogleCustomers(pending.googleId, phoneResult.value, normalizedEmail);

    const phoneGuard = await assertGooglePhoneOkForCustomerSignup(
      phoneResult.value,
      normalizedEmail,
    );
    if (!phoneGuard.ok) {
      return res.status(phoneGuard.status).json({ ...phoneGuard.body, requestId });
    }

    const existingCustomer = await findCustomerForGooglePhoneLink(
      phoneResult.value,
      normalizedEmail,
    );
    if (existingCustomer) {
      const linkedUser = await linkGoogleAuthToExistingCustomer(pending, existingCustomer, {
        chosenPassword,
      });
      const token = await issueSession(linkedUser.id, req);
      setSessionCookie(res, token, "customer");
      return res.json({ token, user: toSafeUser(linkedUser), requestId });
    }

    const identityCheck = await assertContactIdentityAvailable(phoneResult.value, normalizedEmail);
    if (!identityCheck.ok) {
      return res.status(identityCheck.status).json({ ...identityCheck.body, requestId });
    }

    const passwordHash = await hashPassword(chosenPassword);
    const authProvider = "hybrid";

    const result = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(usersTable)
        .values({
          name: pending.name,
          phone: identityCheck.identity.phone,
          email: identityCheck.identity.email,
          passwordHash,
          role: "customer",
          googleId: pending.googleId,
          avatarUrl: pending.avatarUrl,
          authProvider,
          isActive: true,
        })
        .returning();

      if (!user) throw new Error("Failed to create user");

      const [customer] = await tx
        .insert(customersTable)
        .values({
          userId: user.id,
          name: pending.name,
          phone: identityCheck.identity.phone,
          email: identityCheck.identity.email,
          city: "Varanasi",
          status: "active",
        })
        .returning();

      let linkedUser = user;
      if (customer) {
        const [updated] = await tx
          .update(usersTable)
          .set({ customerId: customer.id })
          .where(eq(usersTable.id, user.id))
          .returning();
        if (updated) linkedUser = updated;
      }

      await tx.delete(authPendingGoogleTable).where(eq(authPendingGoogleTable.id, pending.id));
      return linkedUser;
    });

    const token = await issueSession(result.id, req);
    setSessionCookie(res, token, "customer");
    return res.status(201).json({ token, user: toSafeUser(result), requestId });
  } catch (err) {
    req.log.error({ err, requestId }, "Google complete error");
    const message = err instanceof Error ? err.message : "Could not complete sign-up";
    return res.status(400).json({ error: message, code: "ACCOUNT_NOT_ELIGIBLE", requestId });
  }
});

router.post("/auth/forgot-password", async (req, res) => {
  const requestId = getRequestId(req);
  res.setHeader("X-Correlation-Id", requestId);
  try {
    const { phone, email, portal: rawPortal = "customer" } = req.body as {
      phone?: string;
      email?: string;
      portal?: string;
    };

    const portal = parsePasswordPortal(rawPortal);

    const idResult = normalizeLoginIdentifier(phone, email);
    if (!idResult.ok) {
      return res.status(400).json({ error: idResult.error, code: "ACCOUNT_NOT_ELIGIBLE", requestId });
    }

    const user = await findUserByIdentifier(idResult.value.phone, idResult.value.email);
    if (!user || !isRoleAllowedForPortal(user.role, portal)) {
      return res.json({
        ok: true,
        message: "If an account exists, a reset code has been sent.",
        requestId,
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        error: "Account suspended. Contact support.",
        code: "ACCOUNT_NOT_ELIGIBLE",
        requestId,
      });
    }

    if (user.authProvider === "google" && user.role !== "staff") {
      return res.status(400).json({
        error: "This account uses Google Sign-In only. Sign in with Google or set a password from your account.",
        code: "ACCOUNT_NOT_ELIGIBLE",
        requestId,
      });
    }

    const delivery = await sendPasswordResetOtp(user, portal);

    return res.json({
      ok: true,
      message: "Reset code sent",
      sentSms: delivery.sentSms,
      sentEmail: delivery.sentEmail,
      maskedPhone: delivery.maskedPhone,
      maskedEmail: delivery.maskedEmail,
      requestId,
    });
  } catch (err) {
    req.log.error({ err, requestId }, "Forgot password error");
    const message = err instanceof Error ? err.message : "Could not send reset code";
    return res.status(400).json({ error: message, code: "AUTH_INTERNAL_ERROR", requestId });
  }
});

router.post("/auth/reset-password", async (req, res) => {
  const requestId = getRequestId(req);
  res.setHeader("X-Correlation-Id", requestId);
  try {
    const { phone, email, code, newPassword, portal: rawPortal = "customer" } = req.body as {
      phone?: string;
      email?: string;
      code?: string;
      newPassword?: string;
      portal?: string;
    };

    if (!code || !newPassword) {
      return res.status(400).json({ error: "Code and new password are required", code: "ACCOUNT_NOT_ELIGIBLE", requestId });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters", code: "ACCOUNT_NOT_ELIGIBLE", requestId });
    }
    const portal = parsePasswordPortal(rawPortal);

    const idResult = normalizeLoginIdentifier(phone, email);
    if (!idResult.ok) {
      return res.status(400).json({ error: idResult.error, code: "ACCOUNT_NOT_ELIGIBLE", requestId });
    }

    const user = await findUserByIdentifier(idResult.value.phone, idResult.value.email);
    if (!user || !isRoleAllowedForPortal(user.role, portal)) {
      return res.status(400).json({ error: "Invalid or expired reset code", code: "OTP_INVALID_OR_EXPIRED", requestId });
    }

    const valid = await verifyPasswordResetOtp(user.id, code, portal);
    if (!valid) {
      return res.status(400).json({ error: "Invalid or expired reset code", code: "OTP_INVALID_OR_EXPIRED", requestId });
    }

    const passwordHash = await hashPassword(newPassword);
    const authProvider = authProviderAfterPasswordSet(user);
    await db
      .update(usersTable)
      .set({ passwordHash, authProvider, updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));

    await revokeAllUserSessions(user.id);

    return res.json({ ok: true, message: "Password updated successfully. Please sign in.", requestId });
  } catch (err) {
    req.log.error({ err, requestId }, "Reset password error");
    return res.status(500).json({ error: "Internal server error", code: "AUTH_INTERNAL_ERROR", requestId });
  }
});

router.post("/auth/set-password", optionalAuth, requireAuth, async (req, res) => {
  const requestId = getRequestId(req);
  res.setHeader("X-Correlation-Id", requestId);
  try {
    const { newPassword, currentPassword } = req.body as {
      newPassword?: string;
      currentPassword?: string;
    };

    const pwCheck = validateNewPassword(newPassword);
    if (!pwCheck.ok) {
      return res.status(400).json({ error: pwCheck.error, code: "ACCOUNT_NOT_ELIGIBLE", requestId });
    }

    const rows = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id)).limit(1);
    const user = rows[0];
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Authentication required", code: "ACCOUNT_NOT_ELIGIBLE", requestId });
    }

    if (userHasPassword(user)) {
      if (!currentPassword) {
        return res.status(400).json({ error: "Current password is required", code: "ACCOUNT_NOT_ELIGIBLE", requestId });
      }
      if (!user.passwordHash) {
        return res.status(400).json({ error: "Could not verify current password", code: "ACCOUNT_NOT_ELIGIBLE", requestId });
      }
      const { valid } = await verifyPasswordWithUpgrade(currentPassword, user.passwordHash);
      if (!valid) {
        return res.status(400).json({ error: "Current password is incorrect", code: "ACCOUNT_NOT_ELIGIBLE", requestId });
      }
    }

    const passwordHash = await hashPassword(pwCheck.value);
    const authProvider = authProviderAfterPasswordSet(user);

    const [updated] = await db
      .update(usersTable)
      .set({ passwordHash, authProvider, updatedAt: new Date() })
      .where(eq(usersTable.id, user.id))
      .returning();

    if (!updated) {
      return res.status(500).json({ error: "Could not update password", code: "AUTH_INTERNAL_ERROR", requestId });
    }

    return res.json({ ok: true, message: "Password saved", user: toSafeUser(updated), requestId });
  } catch (err) {
    req.log.error({ err, requestId }, "Set password error");
    return res.status(500).json({ error: "Internal server error", code: "AUTH_INTERNAL_ERROR", requestId });
  }
});

router.post("/auth/login", async (req, res) => {
  const requestId = getRequestId(req);
  res.setHeader("X-Correlation-Id", requestId);
  try {
    const { phone, email, password, portal: rawPortal } = req.body;
    if (!password) {
      return res.status(400).json({ error: "Password required", code: "ACCOUNT_NOT_ELIGIBLE", requestId });
    }

    const portal: AuthPortal = isAuthPortal(rawPortal) ? rawPortal : "customer";

    const idResult = normalizeLoginIdentifier(phone, email);
    if (!idResult.ok) {
      return res.status(400).json({ error: idResult.error, code: "ACCOUNT_NOT_ELIGIBLE", requestId });
    }

    const user = await findUserByIdentifier(idResult.value.phone, idResult.value.email);

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials", code: "ACCOUNT_NOT_ELIGIBLE", requestId });
    }
    if (!userHasPassword(user)) {
      return res.status(401).json({
        error: user.role === "staff"
          ? "Invalid credentials"
          : "This account uses Google Sign-In. Use Continue with Google or set a password from your account.",
        code: "ACCOUNT_NOT_ELIGIBLE",
        requestId,
      });
    }

    const { valid, upgradedHash } = await verifyPasswordWithUpgrade(password, user.passwordHash!);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials", code: "ACCOUNT_NOT_ELIGIBLE", requestId });
    }
    if (!user.isActive) {
      return res.status(401).json({ error: "Account suspended", code: "ACCOUNT_NOT_ELIGIBLE", requestId });
    }

    if (!isRoleAllowedForPortal(user.role, portal)) {
      return res.status(403).json({
        error: portalMismatchMessage(portal),
        code: "PORTAL_MISMATCH",
        requestId,
      });
    }

    if (upgradedHash) {
      await db.update(usersTable).set({ passwordHash: upgradedHash, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
      user.passwordHash = upgradedHash;
    }

    if (user.role === "staff") {
      await normalizeStaffPasswordLogin(user.id);
    } else if (["admin", "superadmin", "manager"].includes(user.role) && user.authProvider !== "local") {
      await db
        .update(usersTable)
        .set({ authProvider: "local", updatedAt: new Date() })
        .where(eq(usersTable.id, user.id));
    }

    const token = await issueSession(user.id, req);
    setSessionCookie(res, token, portal);
    return res.json({ token, user: toSafeUser(user), requestId });
  } catch (err) {
    req.log.error({ err, requestId }, "Login error");
    return res.status(500).json({ error: "Internal server error", code: "AUTH_INTERNAL_ERROR", requestId });
  }
});

function parseOtpPurpose(raw: unknown): AuthOtpPurpose | null {
  return raw === "signup" ? "signup" : raw === "login" ? "login" : null;
}

router.get("/auth/otp/config", (_req, res) => {
  return res.json({
    enabled: isOtpSmsConfigured(),
    senderId: process.env.FAST2SMS_SENDER_ID?.trim() || "CWPDTL",
  });
});

router.post("/auth/otp/send", authRateLimit("otp-send", 8, 15 * 60 * 1000), async (req, res) => {
  const requestId = getRequestId(req);
  res.setHeader("X-Correlation-Id", requestId);
  try {
    const { phone, purpose: rawPurpose, name } = req.body as {
      phone?: string;
      purpose?: string;
      name?: string;
    };

    const purpose = parseOtpPurpose(rawPurpose);
    if (!purpose) {
      return res.status(400).json({ error: "Invalid OTP purpose", code: "ACCOUNT_NOT_ELIGIBLE", requestId });
    }

    const phoneResult = parseRequiredMobile(phone);
    if (!phoneResult.ok) {
      return res.status(400).json({ error: phoneResult.error, code: "ACCOUNT_NOT_ELIGIBLE", requestId });
    }

    const delivery = await sendAuthOtp({
      phone: phoneResult.value,
      purpose,
      portal: "customer",
      name,
    });

    logAuthEvent(req, "auth.otp.send", { purpose, phone: phoneResult.value, portal: "customer", requestId });

    return res.json({
      ok: true,
      message: "OTP sent",
      sentSms: delivery.sentSms,
      maskedPhone: delivery.maskedPhone,
      requestId,
    });
  } catch (err) {
    req.log.error({ err, requestId }, "Send OTP error");
    const raw = err instanceof Error ? err.message : "Could not send OTP";
    const authCode: StructuredAuthErrorCode = err instanceof AuthError ? err.code : "AUTH_INTERNAL_ERROR";
    const statusCode = err instanceof AuthError ? err.statusCode : 400;
    logAuthEvent(req, "auth.otp.send.failed", { error: raw, authErrorCode: authCode, requestId });
    return res.status(statusCode).json({
      error: neutralizeOtpSendError(raw, authCode),
      code: authCode,
      requestId,
    });
  }
});

router.post("/auth/otp/verify", authRateLimit("otp-verify", 12, 15 * 60 * 1000), async (req, res) => {
  const requestId = getRequestId(req);
  res.setHeader("X-Correlation-Id", requestId);
  try {
    const {
      phone,
      code,
      purpose: rawPurpose,
      name,
      password,
      email,
      city,
      branchId,
    } = req.body as {
      phone?: string;
      code?: string;
      purpose?: string;
      name?: string;
      password?: string;
      email?: string;
      city?: string;
      branchId?: number;
    };

    const purpose = parseOtpPurpose(rawPurpose);
    if (!purpose) {
      return res.status(400).json({ error: "Invalid OTP purpose", code: "ACCOUNT_NOT_ELIGIBLE", requestId });
    }
    if (!code || code.trim().length !== 6) {
      return res.status(400).json({ error: "Enter the 6-digit OTP", code: "OTP_INVALID_OR_EXPIRED", requestId });
    }

    const phoneResult = parseRequiredMobile(phone);
    if (!phoneResult.ok) {
      return res.status(400).json({ error: phoneResult.error, code: "ACCOUNT_NOT_ELIGIBLE", requestId });
    }

    const verified = await verifyAuthOtp({
      phone: phoneResult.value,
      code: code.trim(),
      purpose,
      portal: "customer",
    });

    if (!verified.ok) {
      logAuthEvent(req, "auth.otp.verify.failed", { purpose, phone: phoneResult.value, authErrorCode: "OTP_INVALID_OR_EXPIRED", requestId });
      return res.status(400).json({ error: "Invalid or expired OTP", code: "OTP_INVALID_OR_EXPIRED", requestId });
    }

    logAuthEvent(req, "auth.otp.verify", { purpose, phone: phoneResult.value, requestId });

    if (purpose === "login") {
      const user = await resolveOrRepairVerifiedCustomer(phoneResult.value, { authProvider: "otp" });

      if (!user.isActive || user.role !== "customer") {
        return res.status(401).json({ error: "Invalid credentials", code: "ACCOUNT_NOT_ELIGIBLE", requestId });
      }

      const token = await issueSession(user.id, req);
      setSessionCookie(res, token, "customer");
      return res.json({ token, user: toSafeUser(user), requestId });
    }

    // purpose === "signup"
    const signupName = (name ?? verified.pendingName ?? "").trim();
    if (!signupName) {
      return res.status(400).json({ error: "Name is required", code: "ACCOUNT_NOT_ELIGIBLE", requestId });
    }

    const emailResult = parseOptionalEmail(email);
    if (!emailResult.ok) {
      return res.status(400).json({ error: emailResult.error, code: "ACCOUNT_NOT_ELIGIBLE", requestId });
    }

    const identityCheck = await assertContactIdentityAvailable(phoneResult.value, emailResult.value);
    if (!identityCheck.ok) {
      return res.status(identityCheck.status).json({ ...identityCheck.body, requestId });
    }

    const pwCheck = validateNewPassword(password);
    if (!pwCheck.ok) {
      return res.status(400).json({ error: pwCheck.error, code: "ACCOUNT_NOT_ELIGIBLE", requestId });
    }
    const passwordHash = await hashPassword(pwCheck.value);
    const authProvider = "local";

    const [user] = await db.insert(usersTable).values({
      name: signupName,
      phone: identityCheck.identity.phone,
      email: identityCheck.identity.email,
      passwordHash,
      role: "customer",
      branchId: branchId || null,
      isActive: true,
      authProvider,
    }).returning();

    if (!user) {
      return res.status(500).json({ error: "Failed to create user", code: "AUTH_INTERNAL_ERROR", requestId });
    }

    const [customer] = await db.insert(customersTable).values({
      userId: user.id,
      name: signupName,
      phone: identityCheck.identity.phone,
      email: identityCheck.identity.email,
      city: city || "Varanasi",
      branchId: branchId || null,
      status: "active",
    }).returning();

    let linkedUser = user;
    if (customer) {
      const [updated] = await db
        .update(usersTable)
        .set({ customerId: customer.id })
        .where(eq(usersTable.id, user.id))
        .returning();
      if (updated) linkedUser = updated;
    }

    const token = await issueSession(linkedUser.id, req);
    setSessionCookie(res, token, "customer");
    return res.status(201).json({ token, user: toSafeUser(linkedUser), requestId });
  } catch (err) {
    req.log.error({ err, requestId }, "Verify OTP error");
    const raw = err instanceof Error ? err.message : "Could not verify OTP";
    const authCode: StructuredAuthErrorCode = err instanceof AuthError ? err.code : "AUTH_INTERNAL_ERROR";
    const statusCode = err instanceof AuthError ? err.statusCode : 400;
    return res.status(statusCode).json({ error: raw, code: authCode, requestId });
  }
});

router.post("/auth/register", async (req, res) => {
  const requestId = getRequestId(req);
  res.setHeader("X-Correlation-Id", requestId);
  try {
    const { name, phone, email, password, address, city, branchId } = req.body;
    if (!name || !password) {
      return res.status(400).json({ error: "Name and password are required", code: "ACCOUNT_NOT_ELIGIBLE", requestId });
    }

    const phoneResult = parseRequiredMobile(phone);
    if (!phoneResult.ok) {
      return res.status(400).json({ error: phoneResult.error, code: "ACCOUNT_NOT_ELIGIBLE", requestId });
    }

    const emailResult = parseRequiredEmail(email);
    if (!emailResult.ok) {
      return res.status(400).json({ error: emailResult.error, code: "ACCOUNT_NOT_ELIGIBLE", requestId });
    }

    const normalizedPhone = phoneResult.value;
    const normalizedEmail = emailResult.value;

    const identityCheck = await assertContactIdentityAvailable(normalizedPhone, normalizedEmail);
    if (!identityCheck.ok) {
      return res.status(identityCheck.status).json({ ...identityCheck.body, requestId });
    }

    const passwordHash = await hashPassword(password);

    const [user] = await db.insert(usersTable).values({
      name,
      phone: identityCheck.identity.phone,
      email: identityCheck.identity.email,
      passwordHash,
      role: "customer",
      branchId: branchId || null,
      isActive: true,
      authProvider: "local",
    }).returning();

    if (!user) {
      return res.status(500).json({ error: "Failed to create user", code: "AUTH_INTERNAL_ERROR", requestId });
    }

    const [customer] = await db.insert(customersTable).values({
      userId: user.id,
      name,
      phone: identityCheck.identity.phone,
      email: identityCheck.identity.email,
      address: address || null,
      city: city || "Varanasi",
      branchId: branchId || null,
      status: "active",
    }).returning();

    let linkedUser = user;
    if (customer) {
      const [updated] = await db.update(usersTable).set({ customerId: customer.id }).where(eq(usersTable.id, user.id)).returning();
      if (updated) linkedUser = updated;
    }

    const token = await issueSession(linkedUser.id, req);
    setSessionCookie(res, token, "customer");
    return res.status(201).json({ token, user: toSafeUser(linkedUser), requestId });
  } catch (err) {
    req.log.error({ err, requestId }, "Register error");
    return res.status(500).json({ error: "Internal server error", code: "AUTH_INTERNAL_ERROR", requestId });
  }
});

router.get("/auth/me", optionalAuth, requireAuth, async (req, res) => {
  const requestId = getRequestId(req);
  res.setHeader("X-Correlation-Id", requestId);
  try {
    const rows = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id)).limit(1);
    const u = rows[0];
    if (!u || !u.isActive) {
      return res.status(401).json({ error: "Authentication required", code: "ACCOUNT_NOT_ELIGIBLE", requestId });
    }

    // Portal role guard
    const portal = parseAuthPortalHeader(req);
    if (portal && !isRoleAllowedForPortal(u.role, portal)) {
      return res.status(403).json({
        error: portalMismatchMessage(portal),
        code: "PORTAL_MISMATCH",
        requestId,
      });
    }

    // Extend httpOnly cookie on activity (rolling session).
    const activeToken = listSessionTokens(req).find(t => t.length > 0);
    if (activeToken && portal) setSessionCookie(res, activeToken, portal);

    return res.json(toSafeUser(u));
  } catch (err) {
    req.log.error({ err, requestId }, "Get me error");
    return res.status(500).json({ error: "Internal server error", code: "AUTH_INTERNAL_ERROR", requestId });
  }
});

router.get("/auth/permissions", optionalAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.json({ role: null, permissions: [], scope: null });
    }
    const perms = await getRolePermissions(req.user.role);
    return res.json({ role: req.user.role, permissions: perms, scope: req.scope ?? null });
  } catch (err) {
    req.log.error({ err }, "Get permissions error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/logout", optionalAuth, async (req, res) => {
  const requestId = getRequestId(req);
  res.setHeader("X-Correlation-Id", requestId);
  try {
    for (const token of listSessionTokens(req)) {
      await db
        .update(sessionsTable)
        .set({ revokedAt: new Date() })
        .where(eq(sessionsTable.tokenHash, hashToken(token)));
    }
    const portal = parseAuthPortalHeader(req);
    if (portal) clearSessionCookie(res, portal);
    else clearAllSessionCookies(res);
    return res.json({ ok: true, requestId });
  } catch (err) {
    req.log.error({ err, requestId }, "Logout error");
    return res.status(500).json({ error: "Internal server error", code: "AUTH_INTERNAL_ERROR", requestId });
  }
});

export default router;
