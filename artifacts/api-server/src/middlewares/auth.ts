import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { db, usersTable, sessionsTable, permissionsTable, permissionOverridesTable, franchiseesTable, customersTable } from "@workspace/db";
import { eq, and, or, isNull, gt } from "drizzle-orm";
import { listSessionTokens } from "../lib/sessionCookie";

export type AuthUser = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  role: "customer" | "staff" | "admin" | "superadmin" | "franchisee" | "manager";
  companyId: number | null;
  branchId: number | null;
  franchiseeId: number | null;
  staffId: number | null;
  customerId: number | null;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      scope?: TenantScope;
    }
  }
}

export type TenantScope = {
  isSuperAdmin: boolean;
  companyId: number | null;
  branchIds: number[] | null; // null = all
  franchiseeId: number | null;
  customerId: number | null;
  staffId: number | null;
};

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function isSuperAdminRole(role: string) {
  return role === "admin" || role === "superadmin";
}

/** Logged-in staff may read/update their own profile and attendance without RBAC seed rows. */
function isStaffSelfService(req: Request): boolean {
  const user = req.user;
  if (!user || user.role !== "staff" || user.staffId == null) return false;

  const path = req.path;
  const method = req.method.toUpperCase();
  const staffId = user.staffId;

  if (path.startsWith("/staff/me/")) {
    return method === "GET" || method === "PATCH" || method === "POST";
  }

  const ownStaff = path.match(/^\/staff\/(\d+)\/(attendance|performance)(\/|$)/);
  if (ownStaff && parseInt(ownStaff[1]!, 10) === staffId) {
    if (path.includes("/attendance") && (method === "GET" || method === "POST")) return true;
    if (path.includes("/performance") && method === "GET") return true;
  }

  if (path === "/analytics/staff-leaderboard" && method === "GET") return true;

  return false;
}

/** Logged-in customers may read/update their own profile without RBAC edit rows. */
function isCustomerSelfService(req: Request): boolean {
  const user = req.user;
  if (!user || user.role !== "customer" || user.customerId == null) return false;

  const path = req.path;
  const method = req.method.toUpperCase();

  if (path === "/customers/me" || path.startsWith("/customers/me/")) {
    return method === "GET" || method === "PATCH";
  }

  const ownCustomer = path.match(/^\/customers\/(\d+)$/);
  if (ownCustomer && method === "PATCH" && parseInt(ownCustomer[1]!, 10) === user.customerId) {
    return true;
  }

  return false;
}

export async function loadUserFromToken(token: string): Promise<AuthUser | null> {
  const th = hashToken(token);
  const rows = await db
    .select({
      user: usersTable,
    })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
    .where(
      and(
        eq(sessionsTable.tokenHash, th),
        isNull(sessionsTable.revokedAt),
        gt(sessionsTable.expiresAt, new Date()),
      ),
    )
    .limit(1);
  const r = rows[0];
  if (!r || !r.user.isActive) return null;
  let u = r.user;

  if (u.role === "customer" && u.customerId == null) {
    const [customer] = await db
      .select({ id: customersTable.id })
      .from(customersTable)
      .where(eq(customersTable.userId, u.id))
      .limit(1);
    if (customer) {
      await db.update(usersTable).set({ customerId: customer.id, updatedAt: new Date() }).where(eq(usersTable.id, u.id));
      u = { ...u, customerId: customer.id };
    }
  }

  return {
    id: u.id,
    name: u.name,
    phone: u.phone,
    email: u.email,
    role: u.role,
    companyId: u.companyId,
    branchId: u.branchId,
    franchiseeId: u.franchiseeId,
    staffId: u.staffId,
    customerId: u.customerId,
  };
}

async function computeScope(user: AuthUser): Promise<TenantScope> {
  const isSuper = isSuperAdminRole(user.role);
  if (isSuper) {
    return {
      isSuperAdmin: true,
      companyId: user.companyId,
      branchIds: null,
      franchiseeId: null,
      customerId: null,
      staffId: null,
    };
  }
  if (user.role === "franchisee" && user.franchiseeId) {
    const fr = await db.select().from(franchiseesTable).where(eq(franchiseesTable.id, user.franchiseeId)).limit(1);
    const branchId = fr[0]?.branchId ?? user.branchId ?? null;
    return {
      isSuperAdmin: false,
      companyId: user.companyId,
      branchIds: branchId ? [branchId] : [],
      franchiseeId: user.franchiseeId,
      customerId: null,
      staffId: null,
    };
  }
  if (user.role === "manager") {
    return {
      isSuperAdmin: false,
      companyId: user.companyId,
      branchIds: user.branchId ? [user.branchId] : [],
      franchiseeId: null,
      customerId: null,
      staffId: null,
    };
  }
  return {
    isSuperAdmin: false,
    companyId: user.companyId,
    branchIds: user.branchId ? [user.branchId] : [],
    franchiseeId: user.franchiseeId,
    customerId: user.customerId,
    staffId: user.staffId,
  };
}

/**
 * Resolve the authenticated user from any valid session token (cookie or bearer).
 * Invalid bearer tokens no longer block a valid httpOnly cookie.
 */
export async function resolveAuthenticatedUser(req: Request): Promise<AuthUser | null> {
  for (const token of listSessionTokens(req)) {
    const user = await loadUserFromToken(token);
    if (user) return user;
  }
  return null;
}

/**
 * optionalAuth: if a session token is present and valid, populates req.user/req.scope.
 * Never rejects — keeps legacy/demo callers working.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const user = await resolveAuthenticatedUser(req);
    if (user) {
      req.user = user;
      req.scope = await computeScope(user);
    }
    return next();
  } catch (err) {
    req.log.warn({ err }, "optionalAuth failed");
    return next(err);
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Authentication required" });
  return next();
}

/**
 * requirePermission(resource, action) — enforces the permissions table.
 *
 * Authentication is required by default. The only exception is an explicit
 * allowlist of public read resources (the landing page catalog). Even those
 * only allow `view`; any write or other action by an anonymous caller is
 * rejected with 401. There is NO blanket demo passthrough — that would mask
 * tenant-isolation bugs and silently grant elevated access.
 */
const READ_ACTIONS = new Set(["view"]);
const PUBLIC_VIEW_RESOURCES = new Set(["services", "branches"]);

export function requirePermission(resource: string, action: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Public catalog reads (services/branches) — guests AND logged-in users.
    // Previously only anonymous callers were allowed, so customers got 403 on
    // the same endpoints the landing page could load without a session.
    if (READ_ACTIONS.has(action) && PUBLIC_VIEW_RESOURCES.has(resource)) {
      if (!req.user) {
        req.scope = {
          isSuperAdmin: false, companyId: null, branchIds: null,
          franchiseeId: null, customerId: null, staffId: null,
        };
      }
      return next();
    }

    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Align with client auth: admin/superadmin are not blocked by missing seed rows.
    if (isSuperAdminRole(req.user.role)) return next();
    if (isStaffSelfService(req)) return next();
    if (isCustomerSelfService(req)) return next();
    const overrides = await db
      .select()
      .from(permissionOverridesTable)
      .where(
        and(
          eq(permissionOverridesTable.resource, resource),
          eq(permissionOverridesTable.action, action),
          or(eq(permissionOverridesTable.userId, req.user.id), eq(permissionOverridesTable.role, req.user.role)),
        ),
      )
      .limit(1);

    if (overrides.length > 0) {
      if (!overrides[0]!.allow) return res.status(403).json({ error: "Permission denied" });
      return next();
    }

    // Role-based check
    const rows = await db
      .select()
      .from(permissionsTable)
      .where(
        and(
          eq(permissionsTable.role, req.user.role),
          eq(permissionsTable.resource, resource),
          eq(permissionsTable.action, action),
          eq(permissionsTable.allow, true),
        ),
      )
      .limit(1);

    if (rows.length === 0) return res.status(403).json({ error: "Permission denied", resource, action });
    return next();
  };
}

export async function getRolePermissions(role: string): Promise<{ resource: string; action: string }[]> {
  const rows = await db
    .select({ resource: permissionsTable.resource, action: permissionsTable.action })
    .from(permissionsTable)
    .where(and(eq(permissionsTable.role, role), eq(permissionsTable.allow, true)));
  return rows;
}
