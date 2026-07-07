import type { Request, Response, NextFunction, Router } from "express";
import { requirePermission } from "./auth";

const METHOD_TO_ACTION: Record<string, string> = {
  GET: "view",
  HEAD: "view",
  POST: "create",
  PUT: "edit",
  PATCH: "edit",
  DELETE: "delete",
};

/** Walk-in routes share the /staff URL prefix but are not staff CRUD. */
export const WALK_IN_PATH_PREFIX = /^\/staff\/walk-in(?:\/|$)/;

export type PermissionOverride = { match: RegExp; method?: string; action: string };

/** Reserved first segment under /catalog/* — not city slugs for SEO pages. */
const CATALOG_RESERVED_SEGMENTS = new Set([
  "pricing", "packages", "addons", "homepage", "homepage-plans", "settings", "services",
  "entitlements", "solar-slabs", "city-availability", "city-content",
  "reminder-hooks", "self-booking", "addon-links", "package-entitlements",
]);

const CATALOG_PUBLIC_GET_PREFIXES = [
  "/catalog/homepage",
  "/catalog/homepage-plans",
  "/catalog/packages",
  "/catalog/addons",
  "/catalog/pricing/quote",
  "/catalog/settings",
  "/catalog/self-booking/check",
  "/catalog/city-content",
  "/catalog/services/",
];

function emptyPublicScope(req: Request) {
  req.scope = {
    isSuperAdmin: false, companyId: null, branchIds: null,
    franchiseeId: null, customerId: null, staffId: null,
  };
}

function isPublicCatalogGet(path: string): boolean {
  if (CATALOG_PUBLIC_GET_PREFIXES.some(p => path === p || path.startsWith(p))) return true;
  const match = path.match(/^\/catalog\/([^/]+)\/([^/]+)$/);
  if (match && !CATALOG_RESERVED_SEGMENTS.has(match[1]!)) return true;
  return false;
}

function catalogResourceForPath(path: string): string {
  if (path.startsWith("/catalog/pricing")) return "pricing";
  if (path.startsWith("/catalog/packages")) return "packages";
  if (path.startsWith("/catalog/addons") || path.startsWith("/catalog/addon-links")) return "addons";
  return "catalog";
}

/**
 * Wraps a sub-router so every request first runs the matching permission check
 * for `resource`. Method → action mapping is conventional (GET=view, etc.).
 * Specific routes may use POST for non-create flows (e.g. `/bulk-message`), so
 * pass a path matcher in `overrides` to map them to a different action.
 */
export function guardResource(
  resource: string,
  overrides: PermissionOverride[] = [],
  excludePaths: RegExp[] = [],
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const path = req.path;
    if (excludePaths.some(p => p.test(path))) return next();
    const resourcePrefix = `/${resource}`;
    if (!path.startsWith(resourcePrefix) && path !== `/${resource.replace(/-/g, "_")}`) {
      return next();
    }
    const method = req.method.toUpperCase();
    let action = METHOD_TO_ACTION[method] ?? "view";
    for (const o of overrides) {
      if ((!o.method || o.method.toUpperCase() === method) && o.match.test(path)) {
        action = o.action;
        break;
      }
    }
    return requirePermission(resource, action)(req, res, next);
  };
}

/**
 * Walk-in entry is staff self-service (search customer, start job, draft booking).
 * Routes live under /staff/walk-in/* but must NOT inherit staff:create from the staff CRUD guard.
 *
 * GET  → staff:view      (portal read — search, customer context, quota)
 * POST resolve → bookings:edit (creates/reuses booking — same action family as /bookings/:id/transition)
 */
export function guardWalkInRoutes() {
  return (req: Request, res: Response, next: NextFunction) => {
    const path = req.path;
    if (!WALK_IN_PATH_PREFIX.test(path)) return next();

    const method = req.method.toUpperCase();
    if (method === "GET") {
      return requirePermission("staff", "view")(req, res, next);
    }
    if (method === "POST" && /\/walk-in\/resolve$/.test(path)) {
      return requirePermission("bookings", "edit")(req, res, next);
    }

    return res.status(403).json({
      error: "Permission denied",
      resource: "staff",
      action: METHOD_TO_ACTION[method] ?? "view",
    });
  };
}

/** Attach a guard to a router only for paths matching `prefix`. */
export function mountGuarded(parent: Router, prefix: string, child: Router, resource: string,
  overrides?: PermissionOverride[]) {
  parent.use(prefix, guardResource(resource, overrides), child);
}

/**
 * Permission guard for master-data router paths (/masters/*, /pricing/*, legacy /catalog/*).
 */
export function guardMasterDataRoutes() {
  return (req: Request, res: Response, next: NextFunction) => {
    const path = req.path;
    const method = req.method.toUpperCase();
    const action = METHOD_TO_ACTION[method] ?? "view";

    if (method === "GET" && path.startsWith("/pricing/")) {
      if (!req.user) {
        emptyPublicScope(req);
        return next();
      }
      return requirePermission("pricing", "view")(req, res, next);
    }

    if (path.startsWith("/masters/")) {
      return requirePermission("masters", action)(req, res, next);
    }

    if (path.startsWith("/catalog/services") || path.startsWith("/catalog/plans")) {
      if (method === "GET" && !req.user) {
        emptyPublicScope(req);
        return next();
      }
      return requirePermission("catalog", action)(req, res, next);
    }

    if (path.startsWith("/saved-locations")) {
      const savedAction = method === "DELETE" ? "edit" : action;
      return requirePermission("customers", savedAction)(req, res, next);
    }

    return next();
  };
}

/** Permission guard for service catalog engine routes (/catalog/*). */
export function guardCatalogRoutes() {
  return (req: Request, res: Response, next: NextFunction) => {
    const path = req.path;
    const method = req.method.toUpperCase();
    const action = METHOD_TO_ACTION[method] ?? "view";

    if (method === "GET" && isPublicCatalogGet(path)) {
      if (!req.user) emptyPublicScope(req);
      return next();
    }

    if (path.startsWith("/catalog/")) {
      const resource = catalogResourceForPath(path);
      return requirePermission(resource, action)(req, res, next);
    }

    return next();
  };
}
