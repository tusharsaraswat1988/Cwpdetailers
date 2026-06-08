import { Router } from "express";
import { db, usersTable, customersTable, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { generateToken, hashToken, optionalAuth, requireAuth, getRolePermissions } from "../middlewares/auth";
import { hashPassword } from "../lib/passwords";

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

router.post("/auth/login", async (req, res) => {
  try {
    const { phone, email, password } = req.body;
    if (!password) return res.status(400).json({ error: "Password required" });

    let user;
    if (phone) {
      const rows = await db.select().from(usersTable).where(eq(usersTable.phone, phone)).limit(1);
      user = rows[0];
    } else if (email) {
      const rows = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
      user = rows[0];
    }

    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    if (user.passwordHash !== hashPassword(password)) return res.status(401).json({ error: "Invalid credentials" });
    if (!user.isActive) return res.status(401).json({ error: "Account suspended" });

    const token = await issueSession(user.id, req);
    const { passwordHash: _, ...safeUser } = user;
    return res.json({ token, user: safeUser });
  } catch (err) {
    req.log.error({ err }, "Login error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/register", async (req, res) => {
  try {
    const { name, phone, email, password, address, city, branchId } = req.body;
    if (!name || !phone || !password) return res.status(400).json({ error: "Name, phone, and password are required" });

    const existing = await db.select().from(usersTable).where(eq(usersTable.phone, phone)).limit(1);
    if (existing.length > 0) return res.status(400).json({ error: "Phone already registered" });

    const [user] = await db.insert(usersTable).values({
      name, phone, email: email || null,
      passwordHash: hashPassword(password),
      role: "customer",
      branchId: branchId || null,
      isActive: true,
    }).returning();

    if (!user) return res.status(500).json({ error: "Failed to create user" });

    const [customer] = await db.insert(customersTable).values({
      userId: user.id,
      name, phone, email: email || null,
      address: address || null,
      city: city || null,
      branchId: branchId || null,
      status: "active",
    }).returning();

    if (customer) {
      await db.update(usersTable).set({ customerId: customer.id }).where(eq(usersTable.id, user.id));
    }

    const { passwordHash: _, ...safeUser } = user;
    const token = await issueSession(user.id, req);
    return res.status(201).json({ token, user: { ...safeUser, customerId: customer?.id ?? null } });
  } catch (err) {
    req.log.error({ err }, "Register error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/auth/me", optionalAuth, requireAuth, async (req, res) => {
  const u = req.user!;
  return res.json(u);
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
