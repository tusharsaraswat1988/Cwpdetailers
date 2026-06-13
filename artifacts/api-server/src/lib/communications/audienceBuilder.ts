import { db } from "@workspace/db";
import {
  customersTable, leadsTable, subscriptionsTable, vehiclesTable,
  bookingsTable, invoicesTable, type AudienceFilterNode,
} from "@workspace/db";
import { eq, and, or, sql, gt, inArray, ne, desc } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { RecipientContext } from "./templateEngine";

export type AudienceScope = {
  companyId?: number | null;
  branchId?: number | null;
  franchiseeId?: number | null;
};

function filterToSql(filter: string, params: Record<string, unknown> = {}, scope: AudienceScope): SQL | undefined {
  const base: SQL[] = [];
  if (scope.companyId) base.push(eq(customersTable.companyId, scope.companyId));
  if (scope.branchId) base.push(eq(customersTable.branchId, scope.branchId));
  if (scope.franchiseeId) base.push(eq(customersTable.franchiseeId, scope.franchiseeId));

  switch (filter) {
    case "all_customers":
      return base.length ? and(...base)! : sql`true`;

    case "active_customers":
      return and(...base, eq(customersTable.status, "active"));

    case "inactive_customers":
      return and(...base, eq(customersTable.status, "inactive"));

    case "payment_due":
      return and(...base, gt(customersTable.totalDues, "0"));

    case "high_value_customers":
      return and(
        ...base,
        sql`EXISTS (
          SELECT 1 FROM ${subscriptionsTable} s
          WHERE s.customer_id = ${customersTable.id}
          AND s.status = 'active'
          AND CAST(s.price AS numeric) >= 5000
        )`,
      );

    case "multiple_vehicles":
      return and(
        ...base,
        sql`(SELECT COUNT(*) FROM ${vehiclesTable} v WHERE v.customer_id = ${customersTable.id}) >= 2`,
      );

    case "cwp_customers":
      return and(
        ...base,
        sql`EXISTS (
          SELECT 1 FROM ${subscriptionsTable} s
          WHERE s.customer_id = ${customersTable.id}
          AND s.type IN ('daily_wash', 'monthly_wash', 'detailing_plan')
          AND s.status = 'active'
        )`,
      );

    case "dcc_customers":
      return and(
        ...base,
        sql`EXISTS (
          SELECT 1 FROM ${subscriptionsTable} s
          WHERE s.customer_id = ${customersTable.id}
          AND s.type = 'daily_wash'
          AND s.status = 'active'
        )`,
      );

    case "solar_customers":
      return and(
        ...base,
        sql`EXISTS (
          SELECT 1 FROM ${subscriptionsTable} s
          WHERE s.customer_id = ${customersTable.id}
          AND s.type = 'solar_amc'
          AND s.status IN ('active', 'expiring')
        )`,
      );

    case "wash_due":
      return and(
        ...base,
        sql`EXISTS (
          SELECT 1 FROM ${subscriptionsTable} s
          WHERE s.customer_id = ${customersTable.id}
          AND s.status = 'active'
          AND s.next_service_date IS NOT NULL
          AND s.next_service_date <= CURRENT_DATE
        )`,
      );

    case "amc_due":
      return and(
        ...base,
        sql`EXISTS (
          SELECT 1 FROM ${subscriptionsTable} s
          WHERE s.customer_id = ${customersTable.id}
          AND s.type = 'solar_amc'
          AND s.status = 'active'
          AND s.next_due_date IS NOT NULL
          AND s.next_due_date <= CURRENT_DATE + INTERVAL '7 days'
        )`,
      );

    case "expiring_package": {
      const days = Number(params.days ?? 7);
      return and(
        ...base,
        sql`EXISTS (
          SELECT 1 FROM ${subscriptionsTable} s
          WHERE s.customer_id = ${customersTable.id}
          AND s.status IN ('active', 'expiring')
          AND s.end_date IS NOT NULL
          AND s.end_date <= CURRENT_DATE + ${sql.raw(String(days))} * INTERVAL '1 day'
        )`,
      );
    }

    case "no_visit_since_days": {
      const days = Number(params.days ?? 30);
      return and(
        ...base,
        sql`NOT EXISTS (
          SELECT 1 FROM ${bookingsTable} b
          WHERE b.customer_id = ${customersTable.id}
          AND b.status = 'completed'
          AND b.completed_at >= CURRENT_DATE - ${sql.raw(String(days))} * INTERVAL '1 day'
        )`,
      );
    }

    default:
      return undefined;
  }
}

/** Lead-based filters return lead IDs, not customer IDs */
function leadFilterToSql(filter: string, scope: AudienceScope): SQL | undefined {
  const base: SQL[] = [];
  if (scope.companyId) base.push(eq(leadsTable.companyId, scope.companyId));
  if (scope.branchId) base.push(eq(leadsTable.branchId, scope.branchId));

  switch (filter) {
    case "lost_leads":
      return and(...base, eq(leadsTable.status, "lost"));
    case "open_leads":
      return and(...base, ne(leadsTable.status, "lost"), ne(leadsTable.status, "completed"), ne(leadsTable.status, "subscription"));
    case "hot_leads":
      return and(...base, inArray(leadsTable.status, ["interested", "quotation"]));
    case "warm_leads":
      return and(...base, eq(leadsTable.status, "contacted"));
    case "cold_leads":
      return and(...base, eq(leadsTable.status, "new"));
    default:
      return undefined;
  }
}

function nodeToCustomerSql(node: AudienceFilterNode, scope: AudienceScope): SQL | undefined {
  if (node.type === "filter") {
    return filterToSql(node.filter, node.params, scope);
  }
  const childSql = node.children.map(c => nodeToCustomerSql(c, scope)).filter(Boolean) as SQL[];
  if (!childSql.length) return undefined;
  return node.operator === "AND" ? and(...childSql)! : or(...childSql)!;
}

function nodeToLeadSql(node: AudienceFilterNode, scope: AudienceScope): SQL | undefined {
  if (node.type === "filter") {
    return leadFilterToSql(node.filter, scope);
  }
  const childSql = node.children.map(c => nodeToLeadSql(c, scope)).filter(Boolean) as SQL[];
  if (!childSql.length) return undefined;
  return node.operator === "AND" ? and(...childSql)! : or(...childSql)!;
}

const LEAD_FILTERS = new Set([
  "lost_leads", "open_leads", "hot_leads", "warm_leads", "cold_leads",
]);

function isLeadOnlyTree(node: AudienceFilterNode): boolean {
  if (node.type === "filter") return LEAD_FILTERS.has(node.filter);
  return node.children.every(isLeadOnlyTree);
}

export async function resolveAudience(
  filterDef: AudienceFilterNode,
  scope: AudienceScope,
): Promise<{ customers: RecipientContext[]; leads: RecipientContext[] }> {
  if (isLeadOnlyTree(filterDef)) {
    const where = nodeToLeadSql(filterDef, scope);
    if (!where) return { customers: [], leads: [] };
    const rows = await db.select({
      id: leadsTable.id,
      name: leadsTable.name,
      phone: leadsTable.phone,
      customerId: leadsTable.customerId,
    }).from(leadsTable).where(where).limit(10000);
    return {
      customers: [],
      leads: rows.map(r => ({
        leadId: r.id,
        customerId: r.customerId,
        customerName: r.name,
        phone: r.phone,
      })),
    };
  }

  const where = nodeToCustomerSql(filterDef, scope);
  if (!where) return { customers: [], leads: [] };

  const rows = await db.select({
    id: customersTable.id,
    name: customersTable.name,
    phone: customersTable.phone,
    email: customersTable.email,
    userId: customersTable.userId,
    totalDues: customersTable.totalDues,
  }).from(customersTable).where(where).limit(10000);

  const customerIds = rows.map(r => r.id);
  const vehicleMap = new Map<number, string>();
  const subMap = new Map<number, { packageName: string; nextServiceDate: string | null }>();

  if (customerIds.length) {
    const vehicles = await db.select({
      customerId: vehiclesTable.customerId,
      reg: vehiclesTable.registrationNumber,
    }).from(vehiclesTable).where(inArray(vehiclesTable.customerId, customerIds));
    for (const v of vehicles) {
      if (!vehicleMap.has(v.customerId)) vehicleMap.set(v.customerId, v.reg);
    }

    const subs = await db.select({
      customerId: subscriptionsTable.customerId,
      type: subscriptionsTable.type,
      nextServiceDate: subscriptionsTable.nextServiceDate,
    }).from(subscriptionsTable)
      .where(and(inArray(subscriptionsTable.customerId, customerIds), eq(subscriptionsTable.status, "active")))
      .orderBy(desc(subscriptionsTable.createdAt));

    for (const s of subs) {
      if (!subMap.has(s.customerId)) {
        subMap.set(s.customerId, {
          packageName: s.type.replace(/_/g, " "),
          nextServiceDate: s.nextServiceDate,
        });
      }
    }
  }

  return {
    customers: rows.map(r => ({
      customerId: r.id,
      customerName: r.name,
      phone: r.phone,
      email: r.email,
      userId: r.userId,
      vehicleNumber: vehicleMap.get(r.id) ?? null,
      amountDue: r.totalDues,
      packageName: subMap.get(r.id)?.packageName ?? null,
      nextServiceDate: subMap.get(r.id)?.nextServiceDate ?? null,
    })),
    leads: [],
  };
}

export async function countAudience(filterDef: AudienceFilterNode, scope: AudienceScope): Promise<number> {
  const { customers, leads } = await resolveAudience(filterDef, scope);
  return customers.length + leads.length;
}
