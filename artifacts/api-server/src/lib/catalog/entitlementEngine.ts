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
  branchId?: number;
  entitlementType: "wash_credit" | "cleaning_credit" | "solar_visit" | "detailing_credit" | "generic";
  creditCount: number;
  validityDays: number;
  validFrom?: string;
  notes?: string;
  packageVersion?: number | null;
  packagePrice?: string | null;
  packageType?: string | null;
  termsAndConditions?: string | null;
  serviceName?: string | null;
};

export async function grantEntitlement(input: EntitlementGrantInput, tx?: Transaction) {
  if (input.creditCount <= 0) {
    throw new Error("Entitlement credit count must be positive");
  }
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
    packageName: input.notes?.startsWith("From package: ") ? input.notes.replace("From package: ", "") : undefined,
    packageVersion: input.packageVersion,
    packagePrice: input.packagePrice,
    packageType: input.packageType,
    termsAndConditions: input.termsAndConditions,
    validityDays: input.validityDays,
    branchId: input.branchId,
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
    branchId?: number;
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

  if (pkg.status !== "active") {
    throw new Error(`Package is ${pkg.status}, only active packages can be granted`);
  }

  const today = getTodayIST();
  if (pkg.effectiveFrom && new Date(pkg.effectiveFrom).toISOString().slice(0, 10) > today) {
    throw new Error("Package is not yet active (future effective date)");
  }
  if (pkg.effectiveUntil && new Date(pkg.effectiveUntil).toISOString().slice(0, 10) < today) {
    throw new Error("Package has expired (past effective until date)");
  }

  if (pkg.cityId && opts?.cityId && pkg.cityId !== opts.cityId) {
    throw new Error(`Package is restricted to city ${pkg.cityId}`);
  }
  if (pkg.branchId && opts?.branchId && pkg.branchId !== opts.branchId) {
    throw new Error(`Package is restricted to branch ${pkg.branchId}`);
  }

  const items = await ctx.select()
    .from(catalogPackageEntitlementsTable)
    .where(eq(catalogPackageEntitlementsTable.packageId, packageId))
    .orderBy(catalogPackageEntitlementsTable.sortOrder);

  const grants = [];

  if (items.length > 0) {
    for (const item of items) {
      if (item.creditCount <= 0) {
        throw new Error(`Package entitlement creditCount must be positive, received ${item.creditCount}`);
      }
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
        branchId: opts?.branchId ?? pkg.branchId ?? undefined,
        entitlementType: item.entitlementType,
        creditCount: item.creditCount,
        validityDays: pkg.validityDays,
        validFrom: opts?.validFrom,
        notes: `From package: ${pkg.name}`,
        packageVersion: pkg.version ?? 1,
        packagePrice: pkg.price,
        packageType: pkg.packageType,
        termsAndConditions: pkg.termsAndConditions,
      }, ctx);
      grants.push(ent);
    }
  } else if (pkg.serviceId) {
    const totalCredits = (pkg.includedVisits ?? 1) + (pkg.complimentaryVisits ?? 0);
    if (totalCredits <= 0) {
      throw new Error(`Package total credits must be positive, received ${totalCredits}`);
    }
    const ent = await grantEntitlement({
      customerId,
      packageId,
      subscriptionId: opts?.subscriptionId,
      serviceId: pkg.serviceId,
      serviceLocationId: opts?.serviceLocationId,
      assetId: opts?.assetId,
      vehicleId: opts?.vehicleId,
      solarSiteId: opts?.solarSiteId,
      cityId: opts?.cityId ?? pkg.cityId ?? undefined,
      branchId: opts?.branchId ?? pkg.branchId ?? undefined,
      entitlementType: "wash_credit",
      creditCount: totalCredits,
      validityDays: pkg.validityDays,
      validFrom: opts?.validFrom,
      notes: `From package: ${pkg.name}`,
      packageVersion: pkg.version ?? 1,
      packagePrice: pkg.price,
      packageType: pkg.packageType,
      termsAndConditions: pkg.termsAndConditions,
    }, ctx);
    grants.push(ent);
  } else {
    throw new Error("Package has no configured entitlements or service association");
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

import { isNull } from "drizzle-orm";

/** Consume credits only after service completion (atomic and idempotent) */
export async function consumeEntitlementOnCompletion(
  entitlementId: number,
  bookingId: number,
  credits = 1,
  tx?: Transaction,
) {
  const run = async (ctx: Transaction) => {
    // Idempotency: verify this (entitlementId, bookingId) was not already consumed
    const [alreadyConsumed] = await ctx.select().from(entitlementConsumptionLogTable)
      .where(and(
        eq(entitlementConsumptionLogTable.entitlementId, entitlementId),
        eq(entitlementConsumptionLogTable.bookingId, bookingId),
        isNull(entitlementConsumptionLogTable.revertedAt),
      )).limit(1);

    if (alreadyConsumed) {
      logger.info({ entitlementId, bookingId }, "Entitlement already consumed for this booking, skipping duplicate deduction");
      return;
    }

    const [ent] = await ctx.select().from(customerEntitlementsTable)
      .where(eq(customerEntitlementsTable.id, entitlementId))
      .for("update")
      .limit(1);

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
  };

  return tx ? run(tx) : db.transaction(run);
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
