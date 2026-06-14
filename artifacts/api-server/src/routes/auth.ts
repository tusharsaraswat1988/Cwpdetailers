import { Router } from "express";
import { db, usersTable, customersTable, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { generateToken, hashToken, optionalAuth, requireAuth, getRolePermissions } from "../middlewares/auth";
import { hashPassword, verifyPasswordWithUpgrade } from "../lib/passwords";
import {
  normalizeLoginIdentifier,
  parseRequiredMobile,
  parseOptionalEmail,
} from "../lib/contactFields";
import { assertContactIdentityAvailable } from "../lib/contactIdentity";

const router = Router();

const SESSION_TTL_DAYS = 30;

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

router.post("/auth/login", async (req, res) => {
  try {
    const { phone, email, password } = req.body;
    if (!password) return res.status(400).json({ error: "Password required" });

    const idResult = normalizeLoginIdentifier(phone, email);
    if (!idResult.ok) return res.status(400).json({ error: idResult.error });

    let user;
    if (idResult.value.phone) {
      const rows = await db.select().from(usersTable).where(eq(usersTable.phone, idResult.value.phone)).limit(1);
      user = rows[0];
    } else if (idResult.value.email) {
      const rows = await db.select().from(usersTable).where(eq(usersTable.email, idResult.value.email)).limit(1);
      user = rows[0];
    }

    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const { valid, upgradedHash } = await verifyPasswordWithUpgrade(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });
    if (!user.isActive) return res.status(401).json({ error: "Account suspended" });

    if (upgradedHash) {
      await db.update(usersTable).set({ passwordHash: upgradedHash, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
      user = { ...user, passwordHash: upgradedHash };
    }

    const token = await issueSession(user.id, req);
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
    const h = req.headers.authorization;
    if (h?.startsWith("Bearer ")) {
      const token = h.slice(7).trim();
      if (token) {
        await db
          .update(sessionsTable)
          .set({ revokedAt: new Date() })
          .where(eq(sessionsTable.tokenHash, hashToken(token)));
      }
    }
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Logout error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
