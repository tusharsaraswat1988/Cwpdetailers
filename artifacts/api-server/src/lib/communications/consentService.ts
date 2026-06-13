import { db } from "@workspace/db";
import { commCustomerConsentsTable, commConsentHistoryTable, customersTable } from "@workspace/db";
import { eq, inArray, sql, desc } from "drizzle-orm";

export type ConsentChannel = "sms" | "whatsapp" | "email" | "push";

const CHANNEL_FIELD: Record<ConsentChannel, "smsConsent" | "whatsappConsent" | "emailConsent" | "pushConsent"> = {
  sms: "smsConsent",
  whatsapp: "whatsappConsent",
  email: "emailConsent",
  push: "pushConsent",
};

export function channelRequiresConsent(channel: string): channel is ConsentChannel {
  return channel === "sms" || channel === "whatsapp" || channel === "email" || channel === "push";
}

export async function getCustomerConsent(customerId: number) {
  const [row] = await db.select().from(commCustomerConsentsTable)
    .where(eq(commCustomerConsentsTable.customerId, customerId)).limit(1);
  return row ?? null;
}

export async function upsertCustomerConsent(
  customerId: number,
  data: {
    brandId?: number | null;
    smsConsent?: boolean;
    whatsappConsent?: boolean;
    emailConsent?: boolean;
    pushConsent?: boolean;
    consentSource?: "walk_in" | "website" | "lead_form" | "invoice" | "manual" | "import";
    consentIp?: string | null;
    birthDate?: string | null;
    anniversaryDate?: string | null;
    notes?: string | null;
    companyId?: number | null;
    changedBy?: number | null;
  },
) {
  const existing = await getCustomerConsent(customerId);
  const now = new Date();

  const recordHistory = async (row: typeof commCustomerConsentsTable.$inferSelect) => {
    await db.insert(commConsentHistoryTable).values({
      customerId,
      brandId: data.brandId ?? row.brandId ?? null,
      smsConsent: row.smsConsent,
      whatsappConsent: row.whatsappConsent,
      emailConsent: row.emailConsent,
      pushConsent: row.pushConsent,
      consentSource: data.consentSource ?? row.consentSource,
      changedBy: data.changedBy ?? null,
      consentIp: data.consentIp ?? row.consentIp,
      companyId: row.companyId,
    });
  };

  if (existing) {
    const [row] = await db.update(commCustomerConsentsTable).set({
      ...data,
      consentDate: now,
      updatedAt: now,
    }).where(eq(commCustomerConsentsTable.customerId, customerId)).returning();
    await recordHistory(row!);
    return row!;
  }

  const [customer] = await db.select({ companyId: customersTable.companyId })
    .from(customersTable).where(eq(customersTable.id, customerId)).limit(1);

  const [row] = await db.insert(commCustomerConsentsTable).values({
    customerId,
    brandId: data.brandId ?? null,
    smsConsent: data.smsConsent ?? false,
    whatsappConsent: data.whatsappConsent ?? false,
    emailConsent: data.emailConsent ?? false,
    pushConsent: data.pushConsent ?? false,
    consentSource: data.consentSource ?? "manual",
    consentIp: data.consentIp ?? null,
    birthDate: data.birthDate ?? null,
    anniversaryDate: data.anniversaryDate ?? null,
    notes: data.notes ?? null,
    companyId: data.companyId ?? customer?.companyId ?? null,
    consentDate: now,
  }).returning();
  await recordHistory(row!);
  return row!;
}

/** Batch-load consents for campaign send — single query, no N+1 */
export async function loadConsentsForCustomers(customerIds: number[]): Promise<Map<number, typeof commCustomerConsentsTable.$inferSelect>> {
  const map = new Map<number, typeof commCustomerConsentsTable.$inferSelect>();
  if (!customerIds.length) return map;

  const unique = [...new Set(customerIds)];
  for (let i = 0; i < unique.length; i += 5000) {
    const batch = unique.slice(i, i + 5000);
    const rows = await db.select().from(commCustomerConsentsTable)
      .where(inArray(commCustomerConsentsTable.customerId, batch));
    for (const r of rows) map.set(r.customerId, r);
  }
  return map;
}

export function hasConsentForChannel(
  consent: typeof commCustomerConsentsTable.$inferSelect | undefined,
  channel: string,
): boolean {
  if (!channelRequiresConsent(channel)) return true;
  if (!consent) return false;
  return consent[CHANNEL_FIELD[channel]] === true;
}

export async function getConsentAnalytics(companyId?: number | null) {
  const [totals] = await db.select({
    total: sql<number>`count(*)::int`,
    sms: sql<number>`count(*) filter (where ${commCustomerConsentsTable.smsConsent})::int`,
    whatsapp: sql<number>`count(*) filter (where ${commCustomerConsentsTable.whatsappConsent})::int`,
    email: sql<number>`count(*) filter (where ${commCustomerConsentsTable.emailConsent})::int`,
    push: sql<number>`count(*) filter (where ${commCustomerConsentsTable.pushConsent})::int`,
    anyConsent: sql<number>`count(*) filter (where ${commCustomerConsentsTable.smsConsent} or ${commCustomerConsentsTable.whatsappConsent} or ${commCustomerConsentsTable.emailConsent} or ${commCustomerConsentsTable.pushConsent})::int`,
  }).from(commCustomerConsentsTable)
    .where(companyId ? eq(commCustomerConsentsTable.companyId, companyId) : undefined);

  const [customerCount] = await db.select({
    count: sql<number>`count(*)::int`,
  }).from(customersTable).where(companyId ? eq(customersTable.companyId, companyId) : undefined);

  const totalCustomers = customerCount?.count ?? 0;
  const withConsent = totals?.anyConsent ?? 0;

  return {
    totalConsents: totals?.total ?? 0,
    smsConsent: totals?.sms ?? 0,
    whatsappConsent: totals?.whatsapp ?? 0,
    emailConsent: totals?.email ?? 0,
    pushConsent: totals?.push ?? 0,
    consentRate: totalCustomers > 0 ? Math.round((withConsent / totalCustomers) * 1000) / 10 : 0,
    totalCustomers,
  };
}

export async function getConsentHistory(customerId: number, limit = 50) {
  return db.select().from(commConsentHistoryTable)
    .where(eq(commConsentHistoryTable.customerId, customerId))
    .orderBy(desc(commConsentHistoryTable.createdAt))
    .limit(limit);
}
