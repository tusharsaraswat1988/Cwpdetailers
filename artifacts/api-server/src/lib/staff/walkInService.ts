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
} from "@workspace/db";
import { eq, and, sql, inArray, desc } from "drizzle-orm";
import type { Request } from "express";
import { getTodayIST } from "../../subscriptions/service";
import { getCustomerServicesHub } from "../customers/customerServicesHub";
import { searchCustomers, searchVehicles } from "../dcms/entitySearch";
import { findEligibleEntitlement } from "../catalog/entitlementEngine";
import { tenantStamp } from "../../middlewares/tenantScope";

export type WalkInServiceKind = "car_wash" | "solar_clean" | "daily_clean" | "daily_wash";

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
  const config = KIND_CONFIG[input.serviceKind];
  const today = getTodayIST();

  if (config.dcmsVisitType) {
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
    if (remaining <= 0) throw new Error(`No remaining ${config.dcmsVisitType} visits on this plan`);
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

  const entitlementOption = options.find(o => o.source === "entitlement");
  const legacyOption = options.find(o => o.source === "legacy_subscription");

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

  const isDraft = consumedFrom === "draft";
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
      ? `Walk-in entry by staff — payment/package pending (created ${today})`
      : `Walk-in entry by staff (${consumedFrom})`,
    amount: entitlementId ? "0" : null,
    entitlementId,
    status: initialStatus,
  });

  const [booking] = await db.insert(bookingsTable).values(values as never).returning();

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

export async function getWalkInCustomerSummary(customerId: number) {
  const [customer] = await db.select({
    id: customersTable.id,
    name: customersTable.name,
    phone: customersTable.phone,
    city: customersTable.city,
  }).from(customersTable).where(eq(customersTable.id, customerId)).limit(1);
  if (!customer) return null;

  const hub = await getCustomerServicesHub(customerId);
  return {
    customer,
    activeEntitlements: hub.entitlements.filter(e => e.status === "active" && e.remainingCredits > 0),
    dailyCleaning: hub.dailyCleaning.filter(d => d.status === "active"),
    legacySubscriptions: hub.legacySubscriptions.filter(s => s.status === "active" && (s.servicesRemaining ?? 0) > 0),
  };
}
