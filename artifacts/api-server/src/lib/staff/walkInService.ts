/**
 * Staff walk-in service entry — validate quota, resolve booking, or create pending draft.
 */

import {
  db,
  bookingsTable,
  customersTable,
  vehiclesTable,
  solarSitesTable,
  servicesTable,
  dcmsSubscriptionsTable,
  customerEntitlementsTable,
  branchesTable,
  staffTable,
  dcmsPlansTable,
  catalogPackagesTable,
  dcmsVisitsTable,
  dcmsActivityLogsTable,
} from "@workspace/db";
import { eq, and, sql, inArray, desc, gte, lte } from "drizzle-orm";
import type { Request } from "express";
import { getTodayIST } from "../../subscriptions/service";
import type { Transaction } from "../../subscriptions/service";
import { getCustomerServicesHub } from "../customers/customerServicesHub";
import { searchCustomers, searchVehicles } from "../dcms/entitySearch";
import { findEligibleEntitlement } from "../catalog/entitlementEngine";
import { tenantStamp } from "../../middlewares/tenantScope";
import { recordStaffLocation } from "../staffLocation/locationService";
import { dayBoundsIST } from "../dcms/dateUtils";
import {
  assertServiceabilitySuccess,
  validateServiceabilityForBooking,
} from "../serviceability";

export type WalkInServiceKind = "car_wash" | "solar_clean" | "daily_clean" | "daily_wash";

export type WalkInEntitlementStatus = "active" | "exhausted" | "expired" | "not_active" | "inactive";

export type WalkInIncludedService = {
  key: string;
  serviceKind: WalkInServiceKind;
  displayName: string;
  remaining: number;
  total: number | null;
  status: WalkInEntitlementStatus;
  recommended: boolean;
  entitlementId?: number;
  subscriptionId?: number;
  legacySubscriptionId?: number;
  visitType?: "cleaning" | "wash";
  solarSiteId?: number;
};

export type WalkInPackageCard = {
  key: string;
  packageName: string;
  packagePrice: string | null;
  expiresAt: string | null;
  status: WalkInEntitlementStatus;
  source: "entitlement" | "dcms" | "legacy_subscription" | null;
  vehicleId?: number;
  vehicleLabel?: string;
  packageId?: number;
  includedServices: WalkInIncludedService[];
};

/** @deprecated Flat card — use WalkInPackageCard.includedServices */
export type WalkInEntitlementCard = WalkInIncludedService & {
  packageName?: string | null;
  vehicleLabel?: string;
  source: "entitlement" | "dcms" | "legacy_subscription" | null;
  expiresAt: string | null;
};

export type WalkInCustomerContext = {
  customer: {
    id: number;
    name: string;
    phone: string;
    city: string | null;
    status: string;
    branchId: number | null;
    branchName: string | null;
  };
  vehicle: {
    id: number;
    registrationNumber: string;
    make: string | null;
    model: string | null;
    label: string;
  } | null;
  vehicles: Array<{
    id: number;
    registrationNumber: string;
    make: string | null;
    model: string | null;
    label: string;
  }>;
  membershipStatus: "active" | "inactive" | "suspended" | "none";
  packages: WalkInPackageCard[];
  primaryPackage: {
    packageName: string;
    packagePrice: string | null;
    validTill: string | null;
  } | null;
  eligibleToday: WalkInIncludedService[];
  hasActivePackage: boolean;
};

const SERVICE_DISPLAY: Record<WalkInServiceKind, string> = {
  car_wash: "Car Wash",
  solar_clean: "Solar",
  daily_clean: "Daily Clean",
  daily_wash: "Car Wash",
};

function cardStatus(
  recordStatus: string,
  remaining: number,
  expiresAt?: string | null,
): WalkInEntitlementStatus {
  if (expiresAt) {
    const expiry = new Date(expiresAt);
    if (!Number.isNaN(expiry.getTime()) && expiry < new Date()) return "expired";
  }
  if (recordStatus === "expired") return "expired";
  if (recordStatus === "exhausted") return "exhausted";
  if (!["active", "paused", "expiring"].includes(recordStatus)) return "inactive";
  if (remaining <= 0) return "exhausted";
  return "active";
}

async function logWalkInAudit(input: {
  staffId: number;
  customerId: number;
  action: "search_customer" | "start_service" | "create_draft_booking" | "package_consumed";
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  bookingId?: number;
  subscriptionId?: number;
  metadata?: Record<string, unknown>;
}) {
  if (input.latitude == null || input.longitude == null) return;
  await recordStaffLocation({
    staffId: input.staffId,
    action: "job_start",
    latitude: input.latitude,
    longitude: input.longitude,
    accuracy: input.accuracy,
    bookingId: input.bookingId ?? null,
    subscriptionId: input.subscriptionId ?? null,
    metadata: {
      walkInAction: input.action,
      customerId: input.customerId,
      ...input.metadata,
    },
  });
}

async function assertWalkInCustomerAccess(customerId: number, staffId: number) {
  const [customer] = await db.select({
    id: customersTable.id,
    status: customersTable.status,
    branchId: customersTable.branchId,
  }).from(customersTable).where(eq(customersTable.id, customerId)).limit(1);

  if (!customer) throw new Error("Customer not found");
  if (customer.status === "inactive") {
    throw new Error("Customer account is inactive — contact admin to reactivate");
  }
  if (customer.status === "suspended") {
    throw new Error("Customer account is suspended — contact admin");
  }

  const [staff] = await db.select({ branchId: staffTable.branchId })
    .from(staffTable).where(eq(staffTable.id, staffId)).limit(1);

  if (
    staff?.branchId != null
    && customer.branchId != null
    && staff.branchId !== customer.branchId
  ) {
    throw new Error("Customer belongs to another branch — walk-in entry not allowed for your branch");
  }

  return customer;
}

type WalkInKindConfig = {
  serviceType: string;
  entitlementTypes: string[];
  /** DCMS subscription quota to draw from (cleaning vs wash allocation). */
  dcmsQuotaType?: "cleaning" | "wash";
  /** Only daily clean uses the DCMS photo workflow — not car wash. */
  useDcmsPhotoWorkflow?: boolean;
};

const KIND_CONFIG: Record<WalkInServiceKind, WalkInKindConfig> = {
  car_wash: { serviceType: "car_wash", entitlementTypes: ["wash_credit", "cleaning_credit"] },
  solar_clean: { serviceType: "solar_cleaning", entitlementTypes: ["solar_visit"] },
  daily_clean: {
    serviceType: "daily_cleaning",
    entitlementTypes: [],
    dcmsQuotaType: "cleaning",
    useDcmsPhotoWorkflow: true,
  },
  daily_wash: {
    serviceType: "car_wash",
    entitlementTypes: ["wash_credit", "cleaning_credit"],
    dcmsQuotaType: "wash",
  },
};

export const DCMS_WASH_WALK_IN_NOTE_RE = /DCMS wash \(subscription (\d+)\)/;

export function parseDcmsWashWalkInSubscriptionId(notes?: string | null): number | null {
  const match = notes?.match(DCMS_WASH_WALK_IN_NOTE_RE);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) ? id : null;
}

export async function consumeDcmsWashFromWalkInBooking(
  booking: { id: number; notes?: string | null; staffId?: number | null; customerId?: number },
  performedBy: number,
  tx: Transaction,
): Promise<boolean> {
  const subscriptionId = parseDcmsWashWalkInSubscriptionId(booking.notes);
  if (!subscriptionId) return false;

  const [sub] = await tx.select().from(dcmsSubscriptionsTable)
    .where(eq(dcmsSubscriptionsTable.id, subscriptionId)).limit(1);
  if (!sub) throw new Error("DCMS wash subscription not found for walk-in booking");
  if (sub.remainingWashes <= 0) throw new Error("DCMS wash quota already consumed");

  const now = new Date();
  const visitDateStr = getTodayIST();

  const [visit] = await tx.insert(dcmsVisitsTable).values({
    subscriptionId,
    vehicleId: sub.vehicleId,
    staffId: booking.staffId ?? performedBy,
    visitType: "wash",
    photoUrl: null,
    visitTime: now,
    visitDate: visitDateStr,
    status: "completed",
    latitude: null,
    longitude: null,
  }).returning();

  const remainingWashes = sub.remainingWashes - 1;
  const remainingCleanings = sub.remainingCleanings;
  const updates = {
    usedWashes: sub.usedWashes + 1,
    remainingWashes,
    updatedAt: now,
    version: sub.version + 1,
    ...(remainingCleanings === 0 && remainingWashes === 0 ? { status: "completed" as const } : {}),
  };

  await tx.update(dcmsSubscriptionsTable)
    .set(updates)
    .where(and(
      eq(dcmsSubscriptionsTable.id, subscriptionId),
      eq(dcmsSubscriptionsTable.version, sub.version),
      sql`${dcmsSubscriptionsTable.remainingWashes} > 0`,
    ));

  await tx.insert(dcmsActivityLogsTable).values({
    subscriptionId,
    action: "wash_consumed",
    entityType: "visit",
    entityId: visit!.id,
    performedBy,
    metadataJson: { visitType: "wash", bookingId: booking.id, walkIn: true },
  });

  return true;
}

export async function searchWalkInTargets(query: string) {
  const q = query.trim();
  if (q.length < 3) return { customers: [], vehicles: [] };

  const [customers, vehicles] = await Promise.all([
    searchCustomers(q, 10),
    searchVehicles({ query: q, registration: q.length >= 3 ? q : undefined, limit: 10 }),
  ]);

  return { customers, vehicles };
}

export type WalkInQuotaOption = {
  source: "entitlement" | "dcms" | "legacy_subscription" | "none";
  label: string;
  entitlementId?: number;
  subscriptionId?: number;
  legacySubscriptionId?: number;
  vehicleId?: number;
  solarSiteId?: number;
  serviceId?: number;
  remaining: number;
  visitType?: "cleaning" | "wash";
};

export async function getWalkInQuotaOptions(
  customerId: number,
  serviceKind: WalkInServiceKind,
  opts?: { vehicleId?: number; solarSiteId?: number },
): Promise<WalkInQuotaOption[]> {
  const hub = await getCustomerServicesHub(customerId);
  const config = KIND_CONFIG[serviceKind];
  const options: WalkInQuotaOption[] = [];

  if (config.dcmsQuotaType && config.useDcmsPhotoWorkflow) {
    for (const sub of hub.dailyCleaning) {
      if (sub.status !== "active") continue;
      if (opts?.vehicleId && sub.vehicleId !== opts.vehicleId) continue;
      const remaining = config.dcmsQuotaType === "cleaning" ? sub.remainingCleanings : sub.remainingWashes;
      if (remaining <= 0) continue;
      options.push({
        source: "dcms",
        label: `${sub.vehicleLabel} · ${sub.planName} (${remaining} ${config.dcmsQuotaType} left)`,
        subscriptionId: sub.id,
        vehicleId: sub.vehicleId,
        remaining,
        visitType: config.dcmsQuotaType,
      });
    }
    if (options.length === 0) {
      options.push({
        source: "none",
        label: "No active daily plan with remaining visits",
        remaining: 0,
      });
    }
    return options;
  }

  if (config.dcmsQuotaType === "wash") {
    for (const sub of hub.dailyCleaning) {
      if (sub.status !== "active") continue;
      if (opts?.vehicleId && sub.vehicleId !== opts.vehicleId) continue;
      if ((sub.allocatedWashes ?? 0) <= 0) continue;
      if (sub.remainingWashes <= 0) continue;
      options.push({
        source: "dcms",
        label: `${sub.vehicleLabel} · ${sub.planName} (${sub.remainingWashes} wash left)`,
        subscriptionId: sub.id,
        vehicleId: sub.vehicleId,
        remaining: sub.remainingWashes,
        visitType: "wash",
      });
    }
  }

  for (const ent of hub.entitlements) {
    if (ent.status !== "active" || ent.remainingCredits <= 0) continue;
    if (!config.entitlementTypes.includes(ent.entitlementType)) continue;
    options.push({
      source: "entitlement",
      label: `${ent.serviceName ?? ent.entitlementType} · ${ent.remainingCredits} credits left`,
      entitlementId: ent.id,
      remaining: ent.remainingCredits,
    });
  }

  for (const sub of hub.legacySubscriptions) {
    if (sub.status !== "active") continue;
    const rem = sub.servicesRemaining ?? 0;
    if (rem <= 0) continue;
    const isSolar = Boolean(sub.solarSiteId);
    if (serviceKind === "solar_clean" && !isSolar) continue;
    if (serviceKind === "car_wash" && isSolar) continue;
    if (opts?.vehicleId && sub.vehicleId !== opts.vehicleId) continue;
    if (opts?.solarSiteId && sub.solarSiteId !== opts.solarSiteId) continue;
    options.push({
      source: "legacy_subscription",
      label: `${sub.serviceName ?? sub.type} · ${rem} visits left`,
      legacySubscriptionId: sub.id,
      vehicleId: sub.vehicleId ?? undefined,
      solarSiteId: sub.solarSiteId ?? undefined,
      remaining: rem,
    });
  }

  if (options.length === 0) {
    options.push({
      source: "none",
      label: "No active package — draft booking (payment pending) will be created",
      remaining: 0,
    });
  }

  return options;
}

async function resolveServiceId(serviceType: string, entitlementId?: number): Promise<number | null> {
  if (entitlementId) {
    const [ent] = await db.select({ serviceId: customerEntitlementsTable.serviceId })
      .from(customerEntitlementsTable).where(eq(customerEntitlementsTable.id, entitlementId)).limit(1);
    if (ent?.serviceId) return ent.serviceId;
  }
  const categoryMap: Record<string, "car_wash" | "solar_cleaning" | "detailing"> = {
    car_wash: "car_wash",
    solar_cleaning: "solar_cleaning",
    daily_cleaning: "car_wash",
  };
  const category = categoryMap[serviceType];
  if (!category) return null;
  const [svc] = await db.select({ id: servicesTable.id }).from(servicesTable)
    .where(eq(servicesTable.category, category)).limit(1);
  return svc?.id ?? null;
}

async function resolveLocation(
  customerId: number,
  vehicleId?: number,
  solarSiteId?: number,
  gps?: { latitude: number; longitude: number },
) {
  if (vehicleId) {
    const [v] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, vehicleId)).limit(1);
    if (v?.locationComplete && v.serviceLat != null && v.serviceLng != null) {
      return {
        address: v.serviceAddress ?? v.locationLabel ?? "Vehicle service location",
        area: v.locationLabel,
        locationLat: v.serviceLat,
        locationLng: v.serviceLng,
        vehicleId: v.id,
      };
    }
  }
  if (solarSiteId) {
    const [s] = await db.select().from(solarSitesTable).where(eq(solarSitesTable.id, solarSiteId)).limit(1);
    if (s?.locationComplete && s.serviceLat != null && s.serviceLng != null) {
      return {
        address: s.address,
        area: s.locationLabel,
        locationLat: s.serviceLat,
        locationLng: s.serviceLng,
        solarSiteId: s.id,
      };
    }
  }
  const [c] = await db.select().from(customersTable).where(eq(customersTable.id, customerId)).limit(1);
  if (gps) {
    return {
      address: c?.address ?? "Walk-in service location",
      area: c?.city,
      locationLat: gps.latitude,
      locationLng: gps.longitude,
      vehicleId,
      solarSiteId,
    };
  }
  throw new Error("Customer location required — enable GPS or set vehicle/site service address");
}

async function findExistingWalkInBooking(
  customerId: number,
  _staffId: number,
  serviceType: string,
  today: string,
) {
  // Phase 5.2: staff lives on assignments/executions — match schedule-only booking fields
  const [row] = await db.select().from(bookingsTable).where(and(
    eq(bookingsTable.customerId, customerId),
    eq(bookingsTable.scheduledDate, today),
    eq(bookingsTable.serviceType, serviceType as never),
    inArray(bookingsTable.status, ["draft", "scheduled", "confirmed", "waiting_assignment"]),
  )).orderBy(desc(bookingsTable.updatedAt)).limit(1);
  return row ?? null;
}

export type ResolveWalkInInput = {
  customerId: number;
  staffId: number;
  serviceKind: WalkInServiceKind;
  vehicleId?: number;
  solarSiteId?: number;
  entitlementId?: number;
  subscriptionId?: number;
  legacySubscriptionId?: number;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  forceDraft?: boolean;
};

export type ResolveWalkInResult =
  | {
      mode: "dcms";
      serviceKind: "daily_clean";
      subscriptionId: number;
      vehicleId: number;
      visitType: "cleaning";
      quotaRemaining: number;
      consumedFrom: "dcms";
    }
  | {
      mode: "booking";
      serviceKind: WalkInServiceKind;
      serviceType: string;
      bookingId: number;
      status: string;
      createdDraft: boolean;
      consumedFrom: "entitlement" | "legacy_subscription" | "draft" | "dcms_wash";
      entitlementId?: number | null;
      message: string;
    };

export async function resolveWalkInJob(req: Request, input: ResolveWalkInInput): Promise<ResolveWalkInResult> {
  await assertWalkInCustomerAccess(input.customerId, input.staffId);

  const config = KIND_CONFIG[input.serviceKind];
  const today = getTodayIST();

  if (config.useDcmsPhotoWorkflow && !input.forceDraft) {
    const subId = input.subscriptionId;
    if (!subId) throw new Error("Select a daily cleaning subscription");
    const [sub] = await db.select().from(dcmsSubscriptionsTable)
      .where(and(
        eq(dcmsSubscriptionsTable.id, subId),
        eq(dcmsSubscriptionsTable.customerId, input.customerId),
        eq(dcmsSubscriptionsTable.status, "active"),
      )).limit(1);
    if (!sub) throw new Error("Active daily cleaning subscription not found");
    if (sub.remainingCleanings <= 0) {
      throw new Error("Package exhausted — no remaining cleaning visits. Create a draft booking instead.");
    }

    await logWalkInAudit({
      staffId: input.staffId,
      customerId: input.customerId,
      action: "start_service",
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy,
      subscriptionId: sub.id,
      metadata: { serviceKind: input.serviceKind, mode: "dcms", visitType: "cleaning" },
    });

    return {
      mode: "dcms",
      serviceKind: "daily_clean",
      subscriptionId: sub.id,
      vehicleId: sub.vehicleId,
      visitType: "cleaning",
      quotaRemaining: sub.remainingCleanings,
      consumedFrom: "dcms",
    };
  }

  let dcmsWashSubscriptionId: number | null = null;
  if (input.serviceKind === "daily_wash" && input.subscriptionId && !input.forceDraft) {
    const [sub] = await db.select().from(dcmsSubscriptionsTable)
      .where(and(
        eq(dcmsSubscriptionsTable.id, input.subscriptionId),
        eq(dcmsSubscriptionsTable.customerId, input.customerId),
        eq(dcmsSubscriptionsTable.status, "active"),
      )).limit(1);
    if (!sub) throw new Error("Active daily plan subscription not found");
    if (sub.remainingWashes <= 0) {
      throw new Error("Package exhausted — no remaining wash visits. Create a draft booking instead.");
    }
    dcmsWashSubscriptionId = sub.id;
  }

  const options = await getWalkInQuotaOptions(input.customerId, input.serviceKind, {
    vehicleId: input.vehicleId,
    solarSiteId: input.solarSiteId,
  });

  let entitlementId = input.entitlementId ?? null;
  let legacySubscriptionId = input.legacySubscriptionId ?? null;
  let consumedFrom: "entitlement" | "legacy_subscription" | "draft" | "dcms_wash" = "draft";
  const legacyOption = options.find(o => o.source === "legacy_subscription");

  if (input.forceDraft) {
    consumedFrom = "draft";
  } else if (dcmsWashSubscriptionId) {
    consumedFrom = "dcms_wash";
  } else {
    const entitlementOption = options.find(o => o.source === "entitlement");

    if (entitlementId || entitlementOption) {
      if (!entitlementId && entitlementOption?.entitlementId) entitlementId = entitlementOption.entitlementId;
      consumedFrom = "entitlement";
    } else if (legacySubscriptionId || legacyOption) {
      if (!legacySubscriptionId && legacyOption?.legacySubscriptionId) {
        legacySubscriptionId = legacyOption.legacySubscriptionId;
      }
      consumedFrom = "legacy_subscription";
    } else if (!options.some(o => o.source === "none")) {
      throw new Error("Select a valid package or credit source");
    }
  }

  const serviceId = await resolveServiceId(config.serviceType, entitlementId ?? undefined);
  const loc = await resolveLocation(
    input.customerId,
    input.vehicleId ?? legacyOption?.vehicleId,
    input.solarSiteId ?? legacyOption?.solarSiteId,
    input.latitude != null && input.longitude != null
      ? { latitude: input.latitude, longitude: input.longitude }
      : undefined,
  );

  const existing = await findExistingWalkInBooking(
    input.customerId,
    input.staffId,
    config.serviceType,
    today,
  );

  if (existing) {
    await db.update(bookingsTable).set({
      updatedAt: new Date(),
    }).where(eq(bookingsTable.id, existing.id));

    return {
      mode: "booking",
      serviceKind: input.serviceKind,
      serviceType: config.serviceType,
      bookingId: existing.id,
      status: existing.status,
      createdDraft: existing.status === "draft",
      consumedFrom,
      entitlementId,
      message: "Using existing booking for today",
    };
  }

  if (entitlementId && consumedFrom === "entitlement") {
    const serviceIdForCheck = serviceId ?? (await resolveServiceId(config.serviceType)) ?? 0;
    if (serviceIdForCheck) {
      const ent = await findEligibleEntitlement({ customerId: input.customerId, serviceId: serviceIdForCheck });
      if (ent) entitlementId = ent.id;
    }
  }

  const isDraft = consumedFrom === "draft" || input.forceDraft === true;
  // Phase 5.2: schedule-only booking — no staff/amount/entitlement/subscription on bookings
  const initialStatus = isDraft ? "draft" as const : "scheduled" as const;

  const serviceability = await validateServiceabilityForBooking({
    customerId: input.customerId,
    address: loc.address,
    locationLat: loc.locationLat,
    locationLng: loc.locationLng,
    serviceId: serviceId ?? null,
    cityName: loc.area ?? null,
  });
  assertServiceabilitySuccess(serviceability);

  const values = tenantStamp(req, {
    customerId: input.customerId,
    vehicleId: loc.vehicleId ?? input.vehicleId ?? null,
    solarSiteId: loc.solarSiteId ?? input.solarSiteId ?? null,
    serviceId,
    scheduledDate: today,
    scheduledTime: null,
    serviceType: config.serviceType,
    address: loc.address,
    area: loc.area ?? null,
    locationLat: loc.locationLat,
    locationLng: loc.locationLng,
    notes: [
      dcmsWashSubscriptionId
        ? `Staff walk-in — DCMS wash (subscription ${dcmsWashSubscriptionId})`
        : isDraft
          ? `Staff walk-in — draft booking, payment pending (created ${today})`
          : `Staff walk-in entry (${consumedFrom})`,
      legacySubscriptionId ? `legacySubscriptionId=${legacySubscriptionId}` : null,
      entitlementId ? `entitlementId=${entitlementId}` : null,
      `staffId=${input.staffId}`,
    ].filter(Boolean).join(" | "),
    status: initialStatus,
    cityId: serviceability.resolvedCityId ?? null,
  });

  const [booking] = await db.insert(bookingsTable).values(values as never).returning();

  await logWalkInAudit({
    staffId: input.staffId,
    customerId: input.customerId,
    action: isDraft ? "create_draft_booking" : "start_service",
    latitude: input.latitude,
    longitude: input.longitude,
    accuracy: input.accuracy,
    bookingId: booking.id,
    subscriptionId: dcmsWashSubscriptionId ?? undefined,
    metadata: {
      serviceKind: input.serviceKind,
      serviceType: config.serviceType,
      mode: "booking",
      consumedFrom,
      createdDraft: isDraft,
    },
  });

  return {
    mode: "booking",
    serviceKind: input.serviceKind,
    serviceType: config.serviceType,
    bookingId: booking.id,
    status: booking.status,
    createdDraft: isDraft,
    consumedFrom,
    entitlementId,
    message: isDraft
      ? "Draft booking created — customer has no active package; admin will confirm payment"
      : `Booking created using ${consumedFrom.replace(/_/g, " ")}`,
  };
}

function entitlementServiceMeta(ent: { entitlementType: string; serviceName: string | null }): {
  serviceKind: WalkInServiceKind;
  displayName: string;
} {
  const name = ent.serviceName?.toLowerCase() ?? "";
  if (ent.entitlementType === "solar_visit") return { serviceKind: "solar_clean", displayName: "Solar" };
  if (name.includes("daily clean") || name.includes("daily cleaning")) {
    return { serviceKind: "daily_clean", displayName: "Daily Clean" };
  }
  if (name.includes("daily wash")) return { serviceKind: "daily_wash", displayName: "Car Wash" };
  if (ent.entitlementType === "wash_credit" || ent.entitlementType === "cleaning_credit") {
    return { serviceKind: "car_wash", displayName: ent.serviceName ?? "Car Wash" };
  }
  return { serviceKind: "car_wash", displayName: ent.serviceName ?? "Service" };
}

function packageAggregateStatus(services: WalkInIncludedService[]): WalkInEntitlementStatus {
  if (services.some(s => s.status === "active" && s.remaining > 0)) return "active";
  if (services.every(s => s.status === "not_active")) return "not_active";
  if (services.some(s => s.status === "expired")) return "expired";
  if (services.some(s => s.status === "exhausted")) return "exhausted";
  return "inactive";
}

/** Merge multiple package rows into one card per vehicle (presentation only). */
function consolidateWalkInPackages(packages: WalkInPackageCard[]): WalkInPackageCard[] {
  const placeholders = packages.filter(p => p.source == null);
  const real = packages.filter(p => p.source != null);
  if (real.length <= 1) return [...real, ...placeholders];

  const byVehicle = new Map<string, WalkInPackageCard[]>();
  for (const pkg of real) {
    const vk = pkg.vehicleId != null ? String(pkg.vehicleId) : "_none";
    const list = byVehicle.get(vk) ?? [];
    list.push(pkg);
    byVehicle.set(vk, list);
  }

  const merged: WalkInPackageCard[] = [];
  for (const [vk, group] of byVehicle) {
    const primary = group.find(p => p.source === "dcms") ?? group[0]!;
    const serviceMap = new Map<string, WalkInIncludedService>();

    for (const pkg of group) {
      for (const svc of pkg.includedServices) {
        const kindKey = svc.serviceKind === "daily_wash" ? "car_wash" : svc.serviceKind;
        const normalized: WalkInIncludedService = {
          ...svc,
          displayName: svc.serviceKind === "daily_wash" ? "Car Wash" : svc.displayName,
        };
        const existing = serviceMap.get(kindKey);
        if (!existing || normalized.remaining > existing.remaining) {
          serviceMap.set(kindKey, normalized);
        }
      }
    }

    const includedServices = [...serviceMap.values()];
    merged.push({
      ...primary,
      key: `merged-${vk}`,
      expiresAt: group.map(p => p.expiresAt).filter(Boolean).sort().at(-1) ?? primary.expiresAt,
      packagePrice: primary.packagePrice ?? group.find(p => p.packagePrice)?.packagePrice ?? null,
      includedServices,
      status: packageAggregateStatus(includedServices),
    });
  }

  return [...merged, ...placeholders];
}

export type WalkInDcmsStop = {
  subscriptionId: number;
  customerName: string;
  vehicleNumber: string;
  vehicleMake: string;
  vehicleModel: string;
  planName: string;
  remainingCleanings: number;
  remainingWashes: number;
  todayStatus: "pending" | "completed" | "rejected";
  visitType: "cleaning" | "wash";
};

export async function getWalkInDcmsStop(
  subscriptionId: number,
  visitType: "cleaning" | "wash",
): Promise<WalkInDcmsStop | null> {
  const [row] = await db.select({
    sub: dcmsSubscriptionsTable,
    planName: dcmsPlansTable.name,
    customerName: customersTable.name,
    vehicleNumber: vehiclesTable.registrationNumber,
    vehicleMake: vehiclesTable.make,
    vehicleModel: vehiclesTable.model,
  })
    .from(dcmsSubscriptionsTable)
    .innerJoin(dcmsPlansTable, eq(dcmsSubscriptionsTable.planId, dcmsPlansTable.id))
    .innerJoin(customersTable, eq(dcmsSubscriptionsTable.customerId, customersTable.id))
    .innerJoin(vehiclesTable, eq(dcmsSubscriptionsTable.vehicleId, vehiclesTable.id))
    .where(eq(dcmsSubscriptionsTable.id, subscriptionId))
    .limit(1);

  if (!row) return null;

  const today = getTodayIST();
  const { start, end } = dayBoundsIST(today);

  const [visit] = await db.select()
    .from(dcmsVisitsTable)
    .where(and(
      eq(dcmsVisitsTable.subscriptionId, subscriptionId),
      eq(dcmsVisitsTable.visitType, visitType),
      gte(dcmsVisitsTable.visitTime, start),
      lte(dcmsVisitsTable.visitTime, end),
    ))
    .orderBy(desc(dcmsVisitsTable.visitTime))
    .limit(1);

  let todayStatus: WalkInDcmsStop["todayStatus"] = "pending";
  if (visit?.status === "completed") todayStatus = "completed";
  else if (visit?.status === "rejected") todayStatus = "rejected";

  return {
    subscriptionId: row.sub.id,
    customerName: row.customerName,
    vehicleNumber: row.vehicleNumber,
    vehicleMake: row.vehicleMake,
    vehicleModel: row.vehicleModel,
    planName: row.planName,
    remainingCleanings: row.sub.remainingCleanings,
    remainingWashes: row.sub.remainingWashes,
    todayStatus,
    visitType,
  };
}

export async function getWalkInCustomerContext(
  customerId: number,
  opts?: { vehicleId?: number },
): Promise<WalkInCustomerContext | null> {
  const [customer] = await db.select({
    id: customersTable.id,
    name: customersTable.name,
    phone: customersTable.phone,
    city: customersTable.city,
    status: customersTable.status,
    branchId: customersTable.branchId,
  }).from(customersTable).where(eq(customersTable.id, customerId)).limit(1);
  if (!customer) return null;

  let branchName: string | null = null;
  if (customer.branchId) {
    const [branch] = await db.select({ name: branchesTable.name })
      .from(branchesTable).where(eq(branchesTable.id, customer.branchId)).limit(1);
    branchName = branch?.name ?? null;
  }

  const vehicleRows = await db.select({
    id: vehiclesTable.id,
    registrationNumber: vehiclesTable.registrationNumber,
    make: vehiclesTable.make,
    model: vehiclesTable.model,
  }).from(vehiclesTable).where(eq(vehiclesTable.customerId, customerId));

  const vehicles = vehicleRows.map(v => ({
    id: v.id,
    registrationNumber: v.registrationNumber,
    make: v.make,
    model: v.model,
    label: [v.registrationNumber, v.make, v.model].filter(Boolean).join(" · "),
  }));

  const selectedVehicle = opts?.vehicleId
    ? vehicles.find(v => v.id === opts.vehicleId) ?? null
    : vehicles.length === 1 ? vehicles[0]! : null;

  const hub = await getCustomerServicesHub(customerId);
  const packages: WalkInPackageCard[] = [];
  const vehicleFilter = opts?.vehicleId;

  const dcmsRows = await db.select({
    subId: dcmsSubscriptionsTable.id,
    planId: dcmsSubscriptionsTable.planId,
    planName: dcmsPlansTable.name,
    planPrice: dcmsPlansTable.price,
  })
    .from(dcmsSubscriptionsTable)
    .innerJoin(dcmsPlansTable, eq(dcmsSubscriptionsTable.planId, dcmsPlansTable.id))
    .where(eq(dcmsSubscriptionsTable.customerId, customerId));

  const dcmsMeta = new Map(dcmsRows.map(r => [r.subId, r]));

  const entitlementRows = await db.select({
    id: customerEntitlementsTable.id,
    packageId: customerEntitlementsTable.packageId,
    packageName: catalogPackagesTable.name,
    packagePrice: catalogPackagesTable.price,
  })
    .from(customerEntitlementsTable)
    .leftJoin(catalogPackagesTable, eq(customerEntitlementsTable.packageId, catalogPackagesTable.id))
    .where(eq(customerEntitlementsTable.customerId, customerId));

  const entPackageMeta = new Map(entitlementRows.map(r => [r.id, r]));

  for (const sub of hub.dailyCleaning) {
    if (vehicleFilter && sub.vehicleId !== vehicleFilter) continue;
    const meta = dcmsMeta.get(sub.id);
    const includedServices: WalkInIncludedService[] = [];

    const cleanStatus = cardStatus(sub.status, sub.remainingCleanings);
    includedServices.push({
      key: `dcms-clean-${sub.id}`,
      serviceKind: "daily_clean",
      displayName: "Daily Clean",
      remaining: sub.remainingCleanings,
      total: sub.allocatedCleanings,
      status: cleanStatus,
      recommended: cleanStatus === "active",
      subscriptionId: sub.id,
      visitType: "cleaning",
    });

    if (sub.allocatedWashes > 0) {
      const washStatus = cardStatus(sub.status, sub.remainingWashes);
      includedServices.push({
        key: `dcms-wash-${sub.id}`,
        serviceKind: "daily_wash",
        displayName: "Car Wash",
        remaining: sub.remainingWashes,
        total: sub.allocatedWashes,
        status: washStatus,
        recommended: false,
        subscriptionId: sub.id,
        visitType: "wash",
      });
    }

    packages.push({
      key: `dcms-${sub.id}`,
      packageName: sub.planName,
      packagePrice: meta?.planPrice ?? null,
      expiresAt: null,
      status: packageAggregateStatus(includedServices),
      source: "dcms",
      vehicleId: sub.vehicleId,
      vehicleLabel: sub.vehicleLabel,
      includedServices,
    });
  }

  const entitlementsByPackage = new Map<string, WalkInPackageCard>();

  for (const ent of hub.entitlements) {
    const meta = entPackageMeta.get(ent.id);
    const pkgKey = meta?.packageId ? `pkg-${meta.packageId}` : `ent-${ent.id}`;
    const { serviceKind, displayName } = entitlementServiceMeta(ent);
    const status = cardStatus(ent.status, ent.remainingCredits, ent.validUntil);

    const service: WalkInIncludedService = {
      key: `ent-${ent.id}`,
      serviceKind,
      displayName,
      remaining: ent.remainingCredits,
      total: ent.totalCredits,
      status,
      recommended: serviceKind === "daily_clean",
      entitlementId: ent.id,
    };

    const existing = entitlementsByPackage.get(pkgKey);
    if (existing) {
      existing.includedServices.push(service);
      existing.status = packageAggregateStatus(existing.includedServices);
      if (!existing.expiresAt && ent.validUntil) existing.expiresAt = ent.validUntil;
    } else {
      entitlementsByPackage.set(pkgKey, {
        key: pkgKey,
        packageName: meta?.packageName ?? ent.packageName ?? ent.serviceName ?? "Package",
        packagePrice: meta?.packagePrice ?? null,
        expiresAt: ent.validUntil,
        status,
        source: "entitlement",
        packageId: meta?.packageId ?? undefined,
        includedServices: [service],
      });
    }
  }
  packages.push(...entitlementsByPackage.values());

  for (const sub of hub.legacySubscriptions) {
    if (vehicleFilter && sub.vehicleId && sub.vehicleId !== vehicleFilter) continue;
    if (vehicleFilter && sub.solarSiteId) continue;

    const isSolar = Boolean(sub.solarSiteId);
    const serviceKind: WalkInServiceKind = isSolar ? "solar_clean" : "car_wash";
    const rem = sub.servicesRemaining ?? 0;
    const status = cardStatus(sub.status, rem, sub.endDate);

    packages.push({
      key: `legacy-${sub.id}`,
      packageName: sub.serviceName ?? sub.type,
      packagePrice: null,
      expiresAt: sub.endDate,
      status,
      source: "legacy_subscription",
      vehicleId: sub.vehicleId ?? undefined,
      includedServices: [{
        key: `legacy-svc-${sub.id}`,
        serviceKind,
        displayName: SERVICE_DISPLAY[serviceKind],
        remaining: rem,
        total: sub.totalServices,
        status,
        recommended: false,
        legacySubscriptionId: sub.id,
        solarSiteId: sub.solarSiteId ?? undefined,
      }],
    });
  }

  const hasAnyRealPackage = packages.some(p => p.source != null);
  if (hasAnyRealPackage && !packages.some(p => p.includedServices.some(s => s.serviceKind === "solar_clean"))) {
    packages.push({
      key: "not-active-solar",
      packageName: "Solar",
      packagePrice: null,
      expiresAt: null,
      status: "not_active",
      source: null,
      includedServices: [{
        key: "not-active-solar-svc",
        serviceKind: "solar_clean",
        displayName: "Solar",
        remaining: 0,
        total: null,
        status: "not_active",
        recommended: false,
      }],
    });
  }

  const consolidated = consolidateWalkInPackages(packages);

  const eligibleToday = consolidated
    .flatMap(p => p.includedServices)
    .filter(s => s.status === "active" && s.remaining > 0);

  const activeServices = eligibleToday;
  const membershipStatus = customer.status === "active"
    ? (activeServices.length > 0 ? "active" : "none")
    : customer.status as WalkInCustomerContext["membershipStatus"];

  const primary = consolidated.find(p => p.source != null) ?? null;

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      city: customer.city,
      status: customer.status,
      branchId: customer.branchId,
      branchName,
    },
    vehicle: selectedVehicle,
    vehicles,
    membershipStatus,
    packages: consolidated,
    primaryPackage: primary
      ? {
          packageName: primary.packageName,
          packagePrice: primary.packagePrice,
          validTill: primary.expiresAt,
        }
      : null,
    eligibleToday,
    hasActivePackage: activeServices.length > 0,
  };
}

/** @deprecated Use getWalkInCustomerContext */
export async function getWalkInCustomerSummary(customerId: number) {
  const ctx = await getWalkInCustomerContext(customerId);
  if (!ctx) return null;
  return {
    customer: ctx.customer,
    activeEntitlements: ctx.packages.flatMap(p => p.includedServices).filter(s => s.status === "active"),
    dailyCleaning: ctx.packages.filter(p => p.source === "dcms").map(p => ({
      id: p.includedServices[0]?.subscriptionId!,
      vehicleId: p.vehicleId!,
      vehicleLabel: p.vehicleLabel ?? "",
      remainingCleanings: p.includedServices.find(s => s.serviceKind === "daily_clean")?.remaining ?? 0,
      remainingWashes: p.includedServices.find(s => s.serviceKind === "daily_wash")?.remaining ?? 0,
    })),
    legacySubscriptions: ctx.packages.filter(p => p.source === "legacy_subscription"),
  };
}
