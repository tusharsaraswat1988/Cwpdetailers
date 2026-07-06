import type { Request } from "express";
import { sql, eq, inArray, or, isNull, type SQL, type AnyColumn } from "drizzle-orm";

/**
 * Tenant scope helpers.
 *
 * `tenantFilters` returns an array of drizzle WHERE clauses derived from the
 * caller's `req.scope`. Pass the columns that exist on the table being
 * queried. Missing columns are simply skipped. The caller is responsible for
 * AND-ing the result with other filters.
 *
 * `tenantStamp` mutates and returns an insert payload so it carries the
 * caller's tenant identifiers automatically, without trusting whatever the
 * client sent. The client value is preserved only if the caller is a
 * super-admin (because they may legitimately create rows in any tenant).
 *
 * `enforceScopeOnRow` returns true if `row` is visible to the caller; use
 * it after fetching a single record by primary key to convert cross-tenant
 * access into a 404.
 *
 * `sqlTenant` returns a raw SQL fragment for use inside `db.execute()`
 * template queries that join or query tables by tenant columns.
 */

export type TenantOpts = {
  companyCol?: AnyColumn;
  branchCol?: AnyColumn;
  franchiseeCol?: AnyColumn;
  customerCol?: AnyColumn;
  staffCol?: AnyColumn;
};

export function tenantFilters(req: Request, opts: TenantOpts): SQL[] {
  const s = req.scope;
  if (!s) {
    // No scope at all = anonymous public read. Only PUBLIC_VIEW resources
    // ever reach a handler in that state, but be safe and return a deny.
    return [sql`false`];
  }

  // Super-admin: only the company filter applies (and only if their session
  // is tied to a specific company). Multi-company root admins skip it.
  // Rows with NULL company_id remain visible (legacy / unstamped queue rows).
  if (s.isSuperAdmin) {
    if (s.companyId && opts.companyCol) {
      return [or(eq(opts.companyCol, s.companyId), isNull(opts.companyCol))];
    }
    return [];
  }

  const out: SQL[] = [];
  if (s.companyId && opts.companyCol) {
    out.push(or(eq(opts.companyCol, s.companyId), isNull(opts.companyCol)));
  }

  if (opts.branchCol && s.branchIds !== null) {
    if (s.branchIds.length === 0) out.push(sql`false`);
    else out.push(or(inArray(opts.branchCol, s.branchIds), isNull(opts.branchCol)));
  }
  if (s.franchiseeId && opts.franchiseeCol) out.push(eq(opts.franchiseeCol, s.franchiseeId));
  if (s.customerId && opts.customerCol) out.push(eq(opts.customerCol, s.customerId));
  if (s.staffId && opts.staffCol) out.push(eq(opts.staffCol, s.staffId));
  return out;
}

type TenantStampFields = {
  companyId?: number | null;
  branchId?: number | null;
  franchiseeId?: number | null;
};

export function tenantStamp<T extends Record<string, unknown>>(req: Request, data: T): T & TenantStampFields {
  const s = req.scope;
  const out = data as T & TenantStampFields;
  if (!s) return out;
  // Super-admins may explicitly set a different tenant when creating cross-
  // tenant resources (e.g. seeding). Otherwise fill from scope.
  if (!s.isSuperAdmin || data["companyId"] == null) {
    if (s.companyId != null) out.companyId = s.companyId;
  }
  if (!s.isSuperAdmin || data["branchId"] == null) {
    if (s.branchIds && s.branchIds.length === 1) out.branchId = s.branchIds[0];
  }
  if (!s.isSuperAdmin || data["franchiseeId"] == null) {
    if (s.franchiseeId != null) out.franchiseeId = s.franchiseeId;
  }
  return out;
}

/**
 * Look up a related row by id, return null if it doesn't exist OR is outside
 * the caller's tenant scope. Use this on `POST` handlers before linking a new
 * resource to an existing one, to prevent a caller from attaching their row
 * to another tenant's customer / staff / etc.
 */
export async function loadIfInScope<R extends Record<string, unknown>>(
  req: Request,
  fetcher: () => Promise<R | undefined>,
  toScopeShape: (row: R) => Parameters<typeof rowInScope>[1],
): Promise<R | null> {
  const row = await fetcher();
  if (!row) return null;
  return rowInScope(req, toScopeShape(row)) ? row : null;
}

/**
 * Build a raw SQL fragment for tenant scoping in raw SQL queries.
 * For each tenant key, provide the alias.column or table.column name.
 * The function returns a SQL fragment that ANDs the active predicates.
 * Use it as:  sql\`SELECT ... FROM ... WHERE ... AND \${sqlTenant(req, {c: 'c.company_id', b: 'b.branch_id'})}\`
 */
export function sqlTenant(req: Request, cols: { c?: string; b?: string; f?: string; cu?: string; s?: string }): SQL {
  const s = req.scope;
  if (!s) return sql`false`;
  const preds: string[] = [];
  if (s.isSuperAdmin) {
    if (s.companyId && cols.c) preds.push(`${cols.c} = ${s.companyId}`);
  } else {
    if (s.companyId && cols.c) preds.push(`${cols.c} = ${s.companyId}`);
    if (s.branchIds !== null && cols.b) {
      if (s.branchIds.length === 0) return sql`false`;
      preds.push(`${cols.b} IN (${s.branchIds.join(", ")})`);
    }
    if (s.franchiseeId && cols.f) preds.push(`${cols.f} = ${s.franchiseeId}`);
    if (s.customerId && cols.cu) preds.push(`${cols.cu} = ${s.customerId}`);
    if (s.staffId && cols.s) preds.push(`${cols.s} = ${s.staffId}`);
  }
  if (preds.length === 0) return sql`true`;
  return sql.raw(preds.join(" AND "));
}

export function rowInScope(req: Request, row: {
  companyId?: number | null;
  branchId?: number | null;
  franchiseeId?: number | null;
  customerId?: number | null;
  staffId?: number | null;
}): boolean {
  const s = req.scope;
  if (!s) return false;
  if (s.isSuperAdmin) {
    if (s.companyId && row.companyId != null && row.companyId !== s.companyId) return false;
    return true;
  }
  if (s.companyId && row.companyId != null && row.companyId !== s.companyId) return false;
  if (s.branchIds !== null && row.branchId != null && !s.branchIds.includes(row.branchId)) return false;
  if (s.franchiseeId && row.franchiseeId != null && row.franchiseeId !== s.franchiseeId) return false;
  if (s.customerId && row.customerId != null && row.customerId !== s.customerId) return false;
  if (s.staffId && row.staffId != null && row.staffId !== s.staffId) return false;
  return true;
}
