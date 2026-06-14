import { db } from "@workspace/db";
import {
  customerEntitlementsTable,
  entitlementConsumptionLogTable,
  catalogPackageEntitlementsTable,
  catalogPackagesTable,
} from "@workspace/db";
import { eq, and, gt, sql } from "drizzle-orm";
import { getTodayIST } from "../../subscriptions/service";
import type { Transaction } from "../../subscriptions/service";
import { logger } from "../logger";

export type EntitlementGrantInput = {
  customerId: number;
  packageId?: number;
  subscriptionId?: number;
  serviceId: number;
  serviceLocationId?: number;
  assetId?: number;
  vehicleId?: number;
  solarSiteId?: number;
  cityId?: number;
  entitlementType: "wash_credit" | "cleaning_credit" | "solar_visit" | "detailing_credit" | "generic";
  creditCount: number;
  validityDays: number;
  validFrom?: string;
  notes?: string;
};

export async function grantEntitlement(input: EntitlementGrantInput, tx?: Transaction) {
  const ctx = tx ?? db;
  const validFrom = input.validFrom ?? getTodayIST();
  const validUntilDate = new Date(validFrom);
  validUntilDate.setDate(validUntilDate.getDate() + input.validityDays);
  const validUntil = validUntilDate.toISOString().split("T")[0];

  const [ent] = await ctx.insert(customerEntitlementsTable).values({
    customerId: input.customerId,
    packageId: input.packageId ?? null,
    subscriptionId: input.subscriptionId ?? null,
    serviceId: input.serviceId,
    serviceLocationId: input.serviceLocationId ?? null,
    assetId: input.assetId ?? null,
    vehicleId: input.vehicleId ?? null,
    solarSiteId: input.solarSiteId ?? null,
    cityId: input.cityId ?? null,
    entitlementType: input.entitlementType,
    totalCredits: input.creditCount,
    usedCredits: 0,
    remainingCredits: input.creditCount,
    validFrom,
    validUntil,
    status: "active",
    notes: input.notes ?? null,
  }).returning();

  logger.info({ entitlementId: ent.id, customerId: input.customerId, credits: input.creditCount }, "Entitlement granted");
  const { syncContractFromEntitlement } = await import("../contracts/contractRegistry");
  await syncContractFromEntitlement(ent, {
    contractType: input.entitlementType === "solar_visit" ? undefined : "contract_credits",
  });
  const { enqueuePendingFromEntitlement } = await import("../assignments/enqueueAdapters");
  await enqueuePendingFromEntitlement(ent.id);
  return ent;
}

/** Grant entitlement with optional used-credit balance and explicit valid-until (legacy migration). */
export async function grantEntitlementWithBalance(
  input: EntitlementGrantInput & { usedCredits?: number; validUntil?: string },
  tx?: Transaction,
) {
  const ctx = tx ?? db;
  const validFrom = input.validFrom ?? getTodayIST();
  let validUntil = input.validUntil;
  if (!validUntil) {
    const validUntilDate = new Date(validFrom);
    validUntilDate.setDate(validUntilDate.getDate() + input.validityDays);
    validUntil = validUntilDate.toISOString().split("T")[0];
  }

  const used = Math.max(0, input.usedCredits ?? 0);
  const total = input.creditCount;
  if (used > total) throw new Error("usedCredits cannot exceed creditCount");
  const remaining = total - used;
  const status = remaining <= 0 ? "exhausted" as const : "active" as const;

  const [ent] = await ctx.insert(customerEntitlementsTable).values({
    customerId: input.customerId,
    packageId: input.packageId ?? null,
    subscriptionId: input.subscriptionId ?? null,
    serviceId: input.serviceId,
    serviceLocationId: input.serviceLocationId ?? null,
    assetId: input.assetId ?? null,
    vehicleId: input.vehicleId ?? null,
    solarSiteId: input.solarSiteId ?? null,
    cityId: input.cityId ?? null,
    entitlementType: input.entitlementType,
    totalCredits: total,
    usedCredits: used,
    remainingCredits: remaining,
    validFrom,
    validUntil,
    status,
    notes: input.notes ?? null,
  }).returning();

  logger.info({ entitlementId: ent.id, customerId: input.customerId, total, used, remaining }, "Entitlement granted with balance");
  const { syncContractFromEntitlement } = await import("../contracts/contractRegistry");
  await syncContractFromEntitlement(ent);
  const { enqueuePendingFromEntitlement } = await import("../assignments/enqueueAdapters");
  await enqueuePendingFromEntitlement(ent.id);
  return ent;
}

export async function grantPackageEntitlements(
  customerId: number,
  packageId: number,
  opts?: {
    subscriptionId?: number;
    cityId?: number;
    validFrom?: string;
    vehicleId?: number;
    solarSiteId?: number;
    serviceLocationId?: number;
    assetId?: number;
    skipBilling?: boolean;
  },
  tx?: Transaction,
) {
  const ctx = tx ?? db;
  const [pkg] = await ctx.select().from(catalogPackagesTable).where(eq(catalogPackagesTable.id, packageId)).limit(1);
  if (!pkg) throw new Error("Package not found");

  const items = await ctx.select()
    .from(catalogPackageEntitlementsTable)
    .where(eq(catalogPackageEntitlementsTable.packageId, packageId))
    .orderBy(catalogPackageEntitlementsTable.sortOrder);

  const grants = [];
  for (const item of items) {
    const ent = await grantEntitlement({
      customerId,
      packageId,
      subscriptionId: opts?.subscriptionId,
      serviceId: item.serviceId,
      serviceLocationId: opts?.serviceLocationId,
      assetId: opts?.assetId,
      vehicleId: opts?.vehicleId,
      solarSiteId: opts?.solarSiteId,
      cityId: opts?.cityId ?? pkg.cityId ?? undefined,
      entitlementType: item.entitlementType,
      creditCount: item.creditCount,
      validityDays: pkg.validityDays,
      validFrom: opts?.validFrom,
      notes: `From package: ${pkg.name}`,
    }, ctx);
    grants.push(ent);
  }
  return grants;
}

/** Grant all package entitlements with per-service used-credit overrides (legacy migration). */
export async function grantPackageEntitlementsWithBalance(
  customerId: number,
  packageId: number,
  opts?: {
    subscriptionId?: number;
    cityId?: number;
    validFrom?: string;
    validUntil?: string;
    usedCreditsByServiceId?: Record<number, number>;
  },
  tx?: Transaction,
) {
  const ctx = tx ?? db;
  const [pkg] = await ctx.select().from(catalogPackagesTable).where(eq(catalogPackagesTable.id, packageId)).limit(1);
  if (!pkg) throw new Error("Package not found");

  const items = await ctx.select()
    .from(catalogPackageEntitlementsTable)
    .where(eq(catalogPackageEntitlementsTable.packageId, packageId))
    .orderBy(catalogPackageEntitlementsTable.sortOrder);

  const grants = [];
  for (const item of items) {
    const usedCredits = opts?.usedCreditsByServiceId?.[item.serviceId];
    const ent = await grantEntitlementWithBalance({
      customerId,
      packageId,
      subscriptionId: opts?.subscriptionId,
      serviceId: item.serviceId,
      cityId: opts?.cityId ?? pkg.cityId ?? undefined,
      entitlementType: item.entitlementType,
      creditCount: item.creditCount,
      validityDays: pkg.validityDays,
      validFrom: opts?.validFrom,
      validUntil: opts?.validUntil,
      usedCredits,
      notes: `From package: ${pkg.name}`,
    }, ctx);
    grants.push(ent);
  }
  return grants;
}

export async function findEligibleEntitlement(opts: {
  customerId: number;
  serviceId: number;
  cityId?: number | null;
}) {
  const today = getTodayIST();
  const conditions = [
    eq(customerEntitlementsTable.customerId, opts.customerId),
    eq(customerEntitlementsTable.serviceId, opts.serviceId),
    eq(customerEntitlementsTable.status, "active"),
    gt(customerEntitlementsTable.remainingCredits, 0),
    sql`${customerEntitlementsTable.validFrom} <= ${today}`,
    sql`${customerEntitlementsTable.validUntil} >= ${today}`,
  ];
  if (opts.cityId) {
    conditions.push(
      sql`(${customerEntitlementsTable.cityId} IS NULL OR ${customerEntitlementsTable.cityId} = ${opts.cityId})`,
    );
  }

  const [ent] = await db.select()
    .from(customerEntitlementsTable)
    .where(and(...conditions))
    .orderBy(customerEntitlementsTable.validUntil)
    .limit(1);
  return ent ?? null;
}

export async function checkSelfBookingEligibility(opts: {
  customerId: number;
  serviceId: number;
  cityId?: number | null;
}) {
  const ent = await findEligibleEntitlement(opts);
  if (!ent) {
    return { eligible: false, reason: "No active entitlement with remaining credits" };
  }
  return {
    eligible: true,
    entitlementId: ent.id,
    remainingCredits: ent.remainingCredits,
    validUntil: ent.validUntil,
  };
}

/** Consume credits only after service completion */
export async function consumeEntitlementOnCompletion(
  entitlementId: number,
  bookingId: number,
  credits = 1,
  tx?: Transaction,
) {
  const ctx = tx ?? db;
  const [ent] = await ctx.select().from(customerEntitlementsTable)
    .where(eq(customerEntitlementsTable.id, entitlementId)).limit(1);
  if (!ent || ent.status !== "active" || ent.remainingCredits < credits) {
    throw new Error("Entitlement not available for consumption");
  }

  const used = ent.usedCredits + credits;
  const remaining = ent.totalCredits - used;
  const status = remaining <= 0 ? "exhausted" as const : ent.status;

  await ctx.update(customerEntitlementsTable)
    .set({ usedCredits: used, remainingCredits: remaining, status, updatedAt: new Date() })
    .where(eq(customerEntitlementsTable.id, entitlementId));

  await ctx.insert(entitlementConsumptionLogTable).values({
    entitlementId,
    bookingId,
    creditsConsumed: credits,
  });

  logger.info({ entitlementId, bookingId, remaining }, "Entitlement consumed on completion");
}

export async function refreshEntitlementStatuses() {
  const today = getTodayIST();
  await db.update(customerEntitlementsTable)
    .set({ status: "expired", updatedAt: new Date() })
    .where(and(
      eq(customerEntitlementsTable.status, "active"),
      sql`${customerEntitlementsTable.validUntil} < ${today}`,
    ));
}

/** Hooks for future notification engine — returns candidates only */
export async function getReminderHookCandidates(hookKey: string) {
  const today = getTodayIST();
  if (hookKey === "solar_amc_no_booking") {
    return db.select().from(customerEntitlementsTable)
      .where(and(
        eq(customerEntitlementsTable.entitlementType, "solar_visit"),
        eq(customerEntitlementsTable.status, "active"),
        gt(customerEntitlementsTable.remainingCredits, 0),
        sql`${customerEntitlementsTable.validUntil} >= ${today}`,
      ));
  }
  if (hookKey === "package_expiry_soon") {
    const soon = new Date();
    soon.setDate(soon.getDate() + 14);
    const soonStr = soon.toISOString().split("T")[0];
    return db.select().from(customerEntitlementsTable)
      .where(and(
        eq(customerEntitlementsTable.status, "active"),
        gt(customerEntitlementsTable.remainingCredits, 0),
        sql`${customerEntitlementsTable.validUntil} <= ${soonStr}`,
        sql`${customerEntitlementsTable.validUntil} >= ${today}`,
      ));
  }
  if (hookKey === "package_credits_low") {
    return db.select().from(customerEntitlementsTable)
      .where(and(
        eq(customerEntitlementsTable.status, "active"),
        sql`${customerEntitlementsTable.remainingCredits} <= 2`,
        sql`${customerEntitlementsTable.remainingCredits} > 0`,
        sql`${customerEntitlementsTable.validUntil} >= ${today}`,
      ));
  }
  return [];
}
