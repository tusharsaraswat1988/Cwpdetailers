import { Router } from "express";
import {
  db,
  usersTable,
  customersTable,
  sessionsTable,
  authPendingGoogleTable,
} from "@workspace/db";
import { eq, and, gt, or, isNull } from "drizzle-orm";
import { generateToken, hashToken, optionalAuth, requireAuth, getRolePermissions } from "../middlewares/auth";
import { hashPassword, verifyPasswordWithUpgrade } from "../lib/passwords";
import {
  normalizeLoginIdentifier,
  parseRequiredMobile,
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

const router = Router();

const SESSION_TTL_DAYS = 30;
const GOOGLE_LINK_TTL_MINUTES = 15;

type GoogleAuthPortal = Extract<AuthPortal, "customer" | "staff">;

function parseGooglePortal(raw: unknown): GoogleAuthPortal {
  return raw === "staff" ? "staff" : "customer";
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
  return safeUser;
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
  if (phone) {
    const rows = await db.select().from(usersTable).where(eq(usersTable.phone, phone)).limit(1);
    return rows[0];
  }
  if (email) {
    const rows = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    return rows[0];
  }
  return undefined;
}

router.get("/auth/google/config", (_req, res) => {
  const clientId = getGoogleClientId();
  return res.json({
    enabled: Boolean(clientId),
    clientId: clientId ?? null,
  });
});

router.post("/auth/google", async (req, res) => {
  try {
    const { idToken, portal: rawPortal = "customer" } = req.body as { idToken?: string; portal?: string };
    if (!idToken) return res.status(400).json({ error: "Google token required" });
    const portal = parseGooglePortal(rawPortal);

    const googleProfile = await verifyGoogleIdToken(idToken);
    const normalizedEmail = googleProfile.email.toLowerCase().trim();

    let user = (
      await db.select().from(usersTable).where(eq(usersTable.googleId, googleProfile.sub)).limit(1)
    )[0];

    if (!user && normalizedEmail) {
      user = (
        await db.select().from(usersTable).where(eq(usersTable.email, normalizedEmail)).limit(1)
      )[0];
    }

    if (user) {
      if (!isRoleAllowedForPortal(user.role, portal)) {
        const msg =
          portal === "staff"
            ? "This Google account is not registered as staff. Contact admin for credentials."
            : "This account cannot sign in here. Use the correct portal.";
        return res.status(403).json({ error: msg });
      }
      if (!user.isActive) return res.status(401).json({ error: "Account suspended" });

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
      return res.json({ token, user: toSafeUser(user) });
    }

    if (portal === "staff") {
      return res.status(404).json({
        error: "No staff account found for this Google email. Ask admin to create your login first.",
      });
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
    });
  } catch (err) {
    req.log.error({ err }, "Google auth error");
    const message = err instanceof Error ? err.message : "Google sign-in failed";
    return res.status(400).json({ error: message });
  }
});

router.post("/auth/google/complete", async (req, res) => {
  try {
    const { linkToken, phone } = req.body as { linkToken?: string; phone?: string };
    if (!linkToken) return res.status(400).json({ error: "Link token required" });

    const phoneResult = parseRequiredMobile(phone);
    if (!phoneResult.ok) return res.status(400).json({ error: phoneResult.error });

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

    if (!pending) return res.status(400).json({ error: "Google sign-in session expired. Please try again." });

    const normalizedEmail = pending.email.toLowerCase().trim();
    await cleanupIncompleteGoogleCustomers(pending.googleId, phoneResult.value, normalizedEmail);

    const identityCheck = await assertContactIdentityAvailable(phoneResult.value, normalizedEmail);
    if (!identityCheck.ok) return res.status(identityCheck.status).json(identityCheck.body);

    const placeholderPassword = await hashPassword(generateOpaqueToken());

    const result = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(usersTable)
        .values({
          name: pending.name,
          phone: identityCheck.identity.phone,
          email: identityCheck.identity.email,
          passwordHash: placeholderPassword,
          role: "customer",
          googleId: pending.googleId,
          avatarUrl: pending.avatarUrl,
          authProvider: "google",
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
    return res.status(201).json({ token, user: toSafeUser(result) });
  } catch (err) {
    req.log.error({ err }, "Google complete error");
    const message = err instanceof Error ? err.message : "Could not complete sign-up";
    return res.status(400).json({ error: message });
  }
});

router.post("/auth/forgot-password", async (req, res) => {
  try {
    const { phone, email, portal: rawPortal = "customer" } = req.body as {
      phone?: string;
      email?: string;
      portal?: string;
    };

    const portal = parseGooglePortal(rawPortal);

    const idResult = normalizeLoginIdentifier(phone, email);
    if (!idResult.ok) return res.status(400).json({ error: idResult.error });

    const user = await findUserByIdentifier(idResult.value.phone, idResult.value.email);
    if (!user || !isRoleAllowedForPortal(user.role, portal)) {
      return res.json({
        ok: true,
        message: "If an account exists, a reset code has been sent.",
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: "Account suspended. Contact support." });
    }

    if (user.authProvider === "google" && !user.passwordHash) {
      return res.status(400).json({
        error: "This account uses Google Sign-In. Sign in with Google or contact support.",
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
    });
  } catch (err) {
    req.log.error({ err }, "Forgot password error");
    const message = err instanceof Error ? err.message : "Could not send reset code";
    return res.status(400).json({ error: message });
  }
});

router.post("/auth/reset-password", async (req, res) => {
  try {
    const { phone, email, code, newPassword, portal: rawPortal = "customer" } = req.body as {
      phone?: string;
      email?: string;
      code?: string;
      newPassword?: string;
      portal?: string;
    };

    if (!code || !newPassword) {
      return res.status(400).json({ error: "Code and new password are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    const portal = parseGooglePortal(rawPortal);

    const idResult = normalizeLoginIdentifier(phone, email);
    if (!idResult.ok) return res.status(400).json({ error: idResult.error });

    const user = await findUserByIdentifier(idResult.value.phone, idResult.value.email);
    if (!user || !isRoleAllowedForPortal(user.role, portal)) {
      return res.status(400).json({ error: "Invalid or expired reset code" });
    }

    const valid = await verifyPasswordResetOtp(user.id, code, portal);
    if (!valid) return res.status(400).json({ error: "Invalid or expired reset code" });

    const passwordHash = await hashPassword(newPassword);
    await db
      .update(usersTable)
      .set({ passwordHash, authProvider: "local", updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));

    await revokeAllUserSessions(user.id);

    return res.json({ ok: true, message: "Password updated successfully. Please sign in." });
  } catch (err) {
    req.log.error({ err }, "Reset password error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const { phone, email, password, portal: rawPortal } = req.body;
    if (!password) return res.status(400).json({ error: "Password required" });

    const portal: AuthPortal = isAuthPortal(rawPortal) ? rawPortal : "customer";

    const idResult = normalizeLoginIdentifier(phone, email);
    if (!idResult.ok) return res.status(400).json({ error: idResult.error });

    const user = await findUserByIdentifier(idResult.value.phone, idResult.value.email);

    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    if (!user.passwordHash) {
      return res.status(401).json({ error: "This account uses Google Sign-In. Use Continue with Google." });
    }

    const { valid, upgradedHash } = await verifyPasswordWithUpgrade(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });
    if (!user.isActive) return res.status(401).json({ error: "Account suspended" });

    if (!isRoleAllowedForPortal(user.role, portal)) {
      return res.status(403).json({ error: portalMismatchMessage(portal) });
    }

    if (upgradedHash) {
      await db.update(usersTable).set({ passwordHash: upgradedHash, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
      user.passwordHash = upgradedHash;
    }

    const token = await issueSession(user.id, req);
    setSessionCookie(res, token, portal);
    return res.json({ token, user: toSafeUser(user) });
  } catch (err) {
    req.log.error({ err }, "Login error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/register", async (req, res) => {
  try {
    const { name, phone, email, password, address, city, branchId } = req.body;
    if (!name || !password) return res.status(400).json({ error: "Name and password are required" });

    const phoneResult = parseRequiredMobile(phone);
    if (!phoneResult.ok) return res.status(400).json({ error: phoneResult.error });

    const emailResult = parseOptionalEmail(email);
    if (!emailResult.ok) return res.status(400).json({ error: emailResult.error });

    const normalizedPhone = phoneResult.value;
    const normalizedEmail = emailResult.value;

    const identityCheck = await assertContactIdentityAvailable(normalizedPhone, normalizedEmail);
    if (!identityCheck.ok) return res.status(identityCheck.status).json(identityCheck.body);

    const passwordHash = await hashPassword(password);

    const [user] = await db.insert(usersTable).values({
      name, phone: identityCheck.identity.phone, email: identityCheck.identity.email,
      passwordHash,
      role: "customer",
      branchId: branchId || null,
      isActive: true,
      authProvider: "local",
    }).returning();

    if (!user) return res.status(500).json({ error: "Failed to create user" });

    const [customer] = await db.insert(customersTable).values({
      userId: user.id,
      name, phone: identityCheck.identity.phone, email: identityCheck.identity.email,
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
    return res.status(201).json({ token, user: toSafeUser(linkedUser) });
  } catch (err) {
    req.log.error({ err }, "Register error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/auth/me", optionalAuth, requireAuth, async (req, res) => {
  try {
    const rows = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id)).limit(1);
    const u = rows[0];
    if (!u || !u.isActive) return res.status(401).json({ error: "Authentication required" });

    // Extend httpOnly cookie on activity (rolling session).
    const portal = parseAuthPortalHeader(req);
    const activeToken = listSessionTokens(req).find(t => t.length > 0);
    if (activeToken && portal) setSessionCookie(res, activeToken, portal);

    return res.json(toSafeUser(u));
  } catch (err) {
    req.log.error({ err }, "Get me error");
    return res.status(500).json({ error: "Internal server error" });
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
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Logout error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
