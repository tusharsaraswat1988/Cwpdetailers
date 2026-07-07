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
} from "@workspace/db";
import { eq, and, sql, inArray, desc } from "drizzle-orm";
import type { Request } from "express";
import { getTodayIST } from "../../subscriptions/service";
import { getCustomerServicesHub } from "../customers/customerServicesHub";
import { searchCustomers, searchVehicles } from "../dcms/entitySearch";
import { findEligibleEntitlement } from "../catalog/entitlementEngine";
import { tenantStamp } from "../../middlewares/tenantScope";
import { recordStaffLocation } from "../staffLocation/locationService";

export type WalkInServiceKind = "car_wash" | "solar_clean" | "daily_clean" | "daily_wash";

export type WalkInEntitlementStatus = "active" | "exhausted" | "expired" | "not_active" | "inactive";

export type WalkInEntitlementCard = {
  key: string;
  serviceKind: WalkInServiceKind;
  displayName: string;
  remaining: number;
  total: number | null;
  expiresAt: string | null;
  status: WalkInEntitlementStatus;
  source: "entitlement" | "dcms" | "legacy_subscription" | null;
  recommended: boolean;
  vehicleId?: number;
  vehicleLabel?: string;
  solarSiteId?: number;
  entitlementId?: number;
  subscriptionId?: number;
  legacySubscriptionId?: number;
  visitType?: "cleaning" | "wash";
  packageName?: string | null;
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
  entitlements: WalkInEntitlementCard[];
  eligibleToday: WalkInEntitlementCard[];
  hasActivePackage: boolean;
};

const SERVICE_DISPLAY: Record<WalkInServiceKind, string> = {
  car_wash: "Car Wash",
  solar_clean: "Solar",
  daily_clean: "Daily Clean",
  daily_wash: "Daily Wash",
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

const KIND_CONFIG: Record<
  WalkInServiceKind,
  { serviceType: string; entitlementTypes: string[]; dcmsVisitType?: "cleaning" | "wash" }
> = {
  car_wash: { serviceType: "car_wash", entitlementTypes: ["wash_credit", "cleaning_credit"] },
  solar_clean: { serviceType: "solar_cleaning", entitlementTypes: ["solar_visit"] },
  daily_clean: { serviceType: "daily_cleaning", entitlementTypes: [], dcmsVisitType: "cleaning" },
  daily_wash: { serviceType: "daily_cleaning", entitlementTypes: [], dcmsVisitType: "wash" },
};

export async function searchWalkInTargets(query: string) {
  const q = query.trim();
  if (q.length < 2) return { customers: [], vehicles: [] };

  const [customers, vehicles] = await Promise.all([
    searchCustomers(q, 10),
    searchVehicles({ query: q, registration: q.length >= 4 ? q : undefined, limit: 10 }),
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

  if (config.dcmsVisitType) {
    for (const sub of hub.dailyCleaning) {
      if (sub.status !== "active") continue;
      if (opts?.vehicleId && sub.vehicleId !== opts.vehicleId) continue;
      const remaining = config.dcmsVisitType === "cleaning" ? sub.remainingCleanings : sub.remainingWashes;
      if (remaining <= 0) continue;
      options.push({
        source: "dcms",
        label: `${sub.vehicleLabel} · ${sub.planName} (${remaining} ${config.dcmsVisitType} left)`,
        subscriptionId: sub.id,
        vehicleId: sub.vehicleId,
        remaining,
        visitType: config.dcmsVisitType,
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
    if (s?.locationComplete && s.latitude != null && s.longitude != null) {
      return {
        address: s.address,
        area: s.locationLabel,
        locationLat: s.latitude,
        locationLng: s.longitude,
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
  staffId: number,
  serviceType: string,
  today: string,
) {
  const [row] = await db.select().from(bookingsTable).where(and(
    eq(bookingsTable.customerId, customerId),
    eq(bookingsTable.scheduledDate, today),
    eq(bookingsTable.serviceType, serviceType),
    inArray(bookingsTable.status, ["pending", "scheduled", "en_route", "in_progress"]),
    sql`(${bookingsTable.staffId} IS NULL OR ${bookingsTable.staffId} = ${staffId})`,
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
      subscriptionId: number;
      vehicleId: number;
      visitType: "cleaning" | "wash";
      quotaRemaining: number;
      consumedFrom: "dcms";
    }
  | {
      mode: "booking";
      bookingId: number;
      status: string;
      createdDraft: boolean;
      consumedFrom: "entitlement" | "legacy_subscription" | "draft";
      entitlementId?: number | null;
      message: string;
    };

export async function resolveWalkInJob(req: Request, input: ResolveWalkInInput): Promise<ResolveWalkInResult> {
  await assertWalkInCustomerAccess(input.customerId, input.staffId);

  const config = KIND_CONFIG[input.serviceKind];
  const today = getTodayIST();

  if (config.dcmsVisitType && !input.forceDraft) {
    const subId = input.subscriptionId;
    if (!subId) throw new Error("Select a daily cleaning subscription");
    const [sub] = await db.select().from(dcmsSubscriptionsTable)
      .where(and(
        eq(dcmsSubscriptionsTable.id, subId),
        eq(dcmsSubscriptionsTable.customerId, input.customerId),
        eq(dcmsSubscriptionsTable.status, "active"),
      )).limit(1);
    if (!sub) throw new Error("Active daily cleaning subscription not found");
    const remaining = config.dcmsVisitType === "cleaning"
      ? sub.remainingCleanings
      : sub.remainingWashes;
    if (remaining <= 0) {
      throw new Error(`Package exhausted — no remaining ${config.dcmsVisitType} visits. Create a draft booking instead.`);
    }

    await logWalkInAudit({
      staffId: input.staffId,
      customerId: input.customerId,
      action: "start_service",
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy,
      subscriptionId: sub.id,
      metadata: { serviceKind: input.serviceKind, mode: "dcms", visitType: config.dcmsVisitType },
    });

    return {
      mode: "dcms",
      subscriptionId: sub.id,
      vehicleId: sub.vehicleId,
      visitType: config.dcmsVisitType,
      quotaRemaining: remaining,
      consumedFrom: "dcms",
    };
  }

  const options = await getWalkInQuotaOptions(input.customerId, input.serviceKind, {
    vehicleId: input.vehicleId,
    solarSiteId: input.solarSiteId,
  });

  let entitlementId = input.entitlementId ?? null;
  let legacySubscriptionId = input.legacySubscriptionId ?? null;
  let consumedFrom: "entitlement" | "legacy_subscription" | "draft" = "draft";
  const legacyOption = options.find(o => o.source === "legacy_subscription");

  if (input.forceDraft) {
    consumedFrom = "draft";
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
      staffId: input.staffId,
      updatedAt: new Date(),
      ...(entitlementId && !existing.entitlementId ? { entitlementId, amount: "0" } : {}),
    }).where(eq(bookingsTable.id, existing.id));

    return {
      mode: "booking",
      bookingId: existing.id,
      status: existing.status,
      createdDraft: existing.status === "pending",
      consumedFrom: existing.entitlementId ? "entitlement" : consumedFrom,
      entitlementId: existing.entitlementId ?? entitlementId,
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
  const initialStatus = isDraft ? "pending" as const : "scheduled" as const;

  const values = tenantStamp(req, {
    customerId: input.customerId,
    vehicleId: loc.vehicleId ?? input.vehicleId ?? null,
    solarSiteId: loc.solarSiteId ?? input.solarSiteId ?? null,
    subscriptionId: legacySubscriptionId,
    serviceId,
    staffId: input.staffId,
    scheduledDate: today,
    scheduledTime: null,
    serviceType: config.serviceType,
    address: loc.address,
    area: loc.area ?? null,
    locationLat: loc.locationLat,
    locationLng: loc.locationLng,
    notes: isDraft
      ? `Staff walk-in — draft booking, payment pending (created ${today})`
      : `Staff walk-in entry (${consumedFrom})`,
    amount: entitlementId ? "0" : null,
    entitlementId,
    status: initialStatus,
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
    metadata: {
      serviceKind: input.serviceKind,
      mode: "booking",
      consumedFrom,
      createdDraft: isDraft,
    },
  });

  return {
    mode: "booking",
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
  const cards: WalkInEntitlementCard[] = [];
  const vehicleFilter = opts?.vehicleId;

  for (const sub of hub.dailyCleaning) {
    if (vehicleFilter && sub.vehicleId !== vehicleFilter) continue;

    if (sub.remainingCleanings > 0 || ["active", "paused"].includes(sub.status)) {
      const status = cardStatus(sub.status, sub.remainingCleanings);
      cards.push({
        key: `dcms-clean-${sub.id}`,
        serviceKind: "daily_clean",
        displayName: SERVICE_DISPLAY.daily_clean,
        remaining: sub.remainingCleanings,
        total: sub.allocatedCleanings,
        expiresAt: null,
        status,
        source: "dcms",
        recommended: status === "active",
        subscriptionId: sub.id,
        vehicleId: sub.vehicleId,
        vehicleLabel: sub.vehicleLabel,
        visitType: "cleaning",
        packageName: sub.planName,
      });
    }

    if (sub.allocatedWashes > 0 || sub.remainingWashes > 0) {
      const washStatus = cardStatus(sub.status, sub.remainingWashes);
      cards.push({
        key: `dcms-wash-${sub.id}`,
        serviceKind: "daily_wash",
        displayName: SERVICE_DISPLAY.daily_wash,
        remaining: sub.remainingWashes,
        total: sub.allocatedWashes,
        expiresAt: null,
        status: washStatus,
        source: "dcms",
        recommended: false,
        subscriptionId: sub.id,
        vehicleId: sub.vehicleId,
        vehicleLabel: sub.vehicleLabel,
        visitType: "wash",
        packageName: sub.planName,
      });
    }
  }

  for (const ent of hub.entitlements) {
    const isCarWash = ["wash_credit", "cleaning_credit"].includes(ent.entitlementType);
    const isSolar = ent.entitlementType === "solar_visit";
    if (!isCarWash && !isSolar) continue;

    const serviceKind: WalkInServiceKind = isSolar ? "solar_clean" : "car_wash";
    const status = cardStatus(ent.status, ent.remainingCredits, ent.validUntil);

    cards.push({
      key: `ent-${ent.id}`,
      serviceKind,
      displayName: SERVICE_DISPLAY[serviceKind],
      remaining: ent.remainingCredits,
      total: ent.totalCredits,
      expiresAt: ent.validUntil,
      status,
      source: "entitlement",
      recommended: false,
      entitlementId: ent.id,
      packageName: ent.packageName ?? ent.serviceName,
    });
  }

  for (const sub of hub.legacySubscriptions) {
    const isSolar = Boolean(sub.solarSiteId);
    const serviceKind: WalkInServiceKind = isSolar ? "solar_clean" : "car_wash";
    if (vehicleFilter && sub.vehicleId && sub.vehicleId !== vehicleFilter) continue;
    if (vehicleFilter && sub.solarSiteId) continue;

    const rem = sub.servicesRemaining ?? 0;
    const status = cardStatus(sub.status, rem, sub.endDate);

    cards.push({
      key: `legacy-${sub.id}`,
      serviceKind,
      displayName: SERVICE_DISPLAY[serviceKind],
      remaining: rem,
      total: sub.totalServices,
      expiresAt: sub.endDate,
      status,
      source: "legacy_subscription",
      recommended: false,
      legacySubscriptionId: sub.id,
      vehicleId: sub.vehicleId ?? undefined,
      solarSiteId: sub.solarSiteId ?? undefined,
      packageName: sub.serviceName ?? sub.type,
    });
  }

  const hasAnyRealPackage = cards.some(c => c.source != null);
  const coveredKinds = new Set(cards.map(c => c.serviceKind));
  if (hasAnyRealPackage) {
    for (const kind of ["solar_clean"] as WalkInServiceKind[]) {
      if (!coveredKinds.has(kind)) {
        cards.push({
          key: `not-active-${kind}`,
          serviceKind: kind,
          displayName: SERVICE_DISPLAY[kind],
          remaining: 0,
          total: null,
          expiresAt: null,
          status: "not_active",
          source: null,
          recommended: false,
        });
      }
    }
  }

  const activeCards = cards.filter(c => c.status === "active" && c.remaining > 0);
  const eligibleToday = activeCards.length > 0
    ? activeCards
    : cards.filter(c => c.status === "active");

  const membershipStatus = customer.status === "active"
    ? (activeCards.length > 0 ? "active" : "none")
    : customer.status as WalkInCustomerContext["membershipStatus"];

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
    entitlements: cards,
    eligibleToday,
    hasActivePackage: activeCards.length > 0,
  };
}

/** @deprecated Use getWalkInCustomerContext */
export async function getWalkInCustomerSummary(customerId: number) {
  const ctx = await getWalkInCustomerContext(customerId);
  if (!ctx) return null;
  return {
    customer: ctx.customer,
    activeEntitlements: ctx.entitlements.filter(e => e.source === "entitlement" && e.status === "active"),
    dailyCleaning: ctx.entitlements.filter(e => e.source === "dcms").map(e => ({
      id: e.subscriptionId!,
      vehicleId: e.vehicleId!,
      vehicleLabel: e.vehicleLabel ?? "",
      remainingCleanings: e.serviceKind === "daily_clean" ? e.remaining : 0,
      remainingWashes: e.serviceKind === "daily_wash" ? e.remaining : 0,
    })),
    legacySubscriptions: ctx.entitlements.filter(e => e.source === "legacy_subscription"),
  };
}
