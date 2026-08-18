/**
 * Staff-initiated extra Car Wash + customer approval + request-bound OTP.
 * Phase 2 is car wash only. Approval authorizes the job; completion consumes entitlement.
 */

import {
  db,
  extraServiceRequestsTable,
  customersTable,
  vehiclesTable,
  staffTable,
  servicesTable,
  serviceAddonsTable,
  serviceAddonLinksTable,
  dcmsSubscriptionsTable,
  dcmsPlansTable,
  type ExtraServiceCommercialSource,
  type ExtraServiceConsentSnapshot,
  type ExtraServiceRequest,
} from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { Request } from "express";
import { tenantStamp } from "../../middlewares/tenantScope";
import { resolveCatalogPricing } from "../catalog/pricingEngine";
import { activateExtraCarWashJob } from "./activateWashJob";
import {
  EXTRA_SERVICE_OTP_MAX_ATTEMPTS,
  EXTRA_SERVICE_OTP_TTL_MS,
  extraServiceFingerprint,
  extraServiceOtpBindingHash,
  formatInr,
  generateExtraServiceOtp,
  isOtpExpired,
  normalizeAddonIds,
  normalizeAmount,
  OPEN_EXTRA_SERVICE_STATUSES,
} from "./fingerprint";

async function quoteWashForVehicle(serviceId: number, vehicleId?: number | null) {
  let vehicleModelId: number | undefined;
  let seatCategoryId: number | null | undefined;
  if (vehicleId) {
    const [vehicle] = await db.select({
      vehicleModelId: vehiclesTable.vehicleModelId,
      seatCategoryId: vehiclesTable.seatCategoryId,
    }).from(vehiclesTable).where(eq(vehiclesTable.id, vehicleId)).limit(1);
    vehicleModelId = vehicle?.vehicleModelId ?? undefined;
    seatCategoryId = vehicle?.seatCategoryId;
  }
  return resolveCatalogPricing({ serviceId, vehicleModelId, seatCategoryId });
}

const OPEN_STATUSES = [...OPEN_EXTRA_SERVICE_STATUSES];

export type ExtraServicePublicAddon = {
  id: number;
  name: string;
  price: number;
};

export type ExtraServicePublicView = {
  id: number;
  requestType: string;
  status: ExtraServiceRequest["status"];
  customerId: number;
  customerName: string;
  staffId: number;
  staffName: string;
  vehicleId: number;
  vehicleLabel: string;
  serviceId: number;
  serviceName: string;
  addonIds: number[];
  addonNames: string[];
  commercialSource: ExtraServiceCommercialSource;
  dcmsSubscriptionId: number | null;
  amount: number;
  amountDisplay: string;
  entitlementLabel: string | null;
  otpExpiresAt: string | null;
  otpExpired: boolean;
  customerApprovedAt: string | null;
  otpVerifiedAt: string | null;
  bookingId: number | null;
  executionId: number | null;
  createdAt: string;
  /** Present only for the owning customer while the OTP is still valid. */
  otp?: string;
};

function toAmountNumber(value: string | number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function vehicleLabel(v: { registrationNumber: string; make: string | null; model: string | null }): string {
  return [v.make, v.model, v.registrationNumber].filter(Boolean).join(" ");
}

async function loadStaff(staffId: number) {
  const [staff] = await db.select({
    id: staffTable.id,
    name: staffTable.name,
    branchId: staffTable.branchId,
    companyId: staffTable.companyId,
    franchiseeId: staffTable.franchiseeId,
  }).from(staffTable).where(eq(staffTable.id, staffId)).limit(1);
  if (!staff) throw new Error("Staff account not found");
  return staff;
}

async function loadCustomer(customerId: number) {
  const [customer] = await db.select({
    id: customersTable.id,
    name: customersTable.name,
    status: customersTable.status,
    branchId: customersTable.branchId,
  }).from(customersTable).where(eq(customersTable.id, customerId)).limit(1);
  if (!customer) throw new Error("Customer not found");
  if (customer.status === "inactive" || customer.status === "suspended") {
    throw new Error("Customer account is not active");
  }
  return customer;
}

function toPublicView(
  row: ExtraServiceRequest,
  names: { customerName: string; staffName: string },
  opts?: { includeOtp?: boolean },
): ExtraServicePublicView {
  const snapshot = row.consentSnapshot;
  const expired = isOtpExpired(row.otpExpiresAt);
  return {
    id: row.id,
    requestType: row.requestType,
    status: row.status,
    customerId: row.customerId,
    customerName: names.customerName,
    staffId: row.staffId,
    staffName: names.staffName,
    vehicleId: row.vehicleId,
    vehicleLabel: snapshot.vehicleLabel,
    serviceId: row.serviceId,
    serviceName: snapshot.serviceName,
    addonIds: row.addonIds ?? [],
    addonNames: snapshot.addonNames,
    commercialSource: row.commercialSource,
    dcmsSubscriptionId: row.dcmsSubscriptionId,
    amount: toAmountNumber(row.amount),
    amountDisplay: snapshot.amountDisplay,
    entitlementLabel: snapshot.entitlementLabel,
    otpExpiresAt: row.otpExpiresAt?.toISOString() ?? null,
    otpExpired: row.status === "customer_approved" && expired,
    customerApprovedAt: row.customerApprovedAt?.toISOString() ?? null,
    otpVerifiedAt: row.otpVerifiedAt?.toISOString() ?? null,
    bookingId: row.bookingId,
    executionId: row.executionId,
    createdAt: row.createdAt.toISOString(),
    ...(opts?.includeOtp && row.otpCode && !expired ? { otp: row.otpCode } : {}),
  };
}

async function namesFor(row: ExtraServiceRequest) {
  const [[customer], [staff]] = await Promise.all([
    db.select({ name: customersTable.name }).from(customersTable).where(eq(customersTable.id, row.customerId)).limit(1),
    db.select({ name: staffTable.name }).from(staffTable).where(eq(staffTable.id, row.staffId)).limit(1),
  ]);
  return {
    customerName: customer?.name ?? "Customer",
    staffName: staff?.name ?? row.consentSnapshot.staffName,
  };
}

export async function getStaffExtraServiceContext(staffId: number, opts: {
  customerId?: number;
  subscriptionId?: number;
  vehicleId?: number;
}) {
  await loadStaff(staffId);

  let customerId = opts.customerId ?? null;
  let defaultVehicleId = opts.vehicleId ?? null;
  let dccSubscriptionId: number | null = opts.subscriptionId ?? null;

  if (opts.subscriptionId) {
    const [sub] = await db.select({
      id: dcmsSubscriptionsTable.id,
      customerId: dcmsSubscriptionsTable.customerId,
      vehicleId: dcmsSubscriptionsTable.vehicleId,
      remainingWashes: dcmsSubscriptionsTable.remainingWashes,
      allocatedWashes: dcmsSubscriptionsTable.allocatedWashes,
      status: dcmsSubscriptionsTable.status,
    }).from(dcmsSubscriptionsTable).where(eq(dcmsSubscriptionsTable.id, opts.subscriptionId)).limit(1);
    if (!sub) throw new Error("Daily plan not found");
    customerId = sub.customerId;
    defaultVehicleId = defaultVehicleId ?? sub.vehicleId;
    dccSubscriptionId = sub.id;
  }

  if (customerId == null) throw new Error("Customer is required");
  const customer = await loadCustomer(customerId);

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
    label: vehicleLabel(v),
  }));

  const serviceRows = await db.select({
    id: servicesTable.id,
    name: servicesTable.name,
    basePrice: servicesTable.basePrice,
    durationMinutes: servicesTable.durationMinutes,
  }).from(servicesTable).where(and(
    eq(servicesTable.category, "car_wash"),
    eq(servicesTable.isActive, true),
  ));

  const serviceIds = serviceRows.map(s => s.id);
  const addonLinks = serviceIds.length
    ? await db.select({
      serviceId: serviceAddonLinksTable.serviceId,
      addon: serviceAddonsTable,
    })
      .from(serviceAddonLinksTable)
      .innerJoin(serviceAddonsTable, eq(serviceAddonLinksTable.addonId, serviceAddonsTable.id))
      .where(and(
        eq(serviceAddonLinksTable.isActive, true),
        eq(serviceAddonsTable.isActive, true),
        inArray(serviceAddonLinksTable.serviceId, serviceIds),
      ))
    : [];

  const addonsByService: Record<number, ExtraServicePublicAddon[]> = {};
  for (const row of addonLinks) {
    if (row.serviceId == null) continue;
    const list = addonsByService[row.serviceId] ?? [];
    list.push({
      id: row.addon.id,
      name: row.addon.name,
      price: toAmountNumber(row.addon.basePrice),
    });
    addonsByService[row.serviceId] = list;
  }

  const services = [];
  for (const svc of serviceRows) {
    const quote = await quoteWashForVehicle(svc.id, defaultVehicleId ?? vehicles[0]?.id);
    services.push({
      id: svc.id,
      name: svc.name,
      price: quote?.amount ?? toAmountNumber(svc.basePrice),
      durationMinutes: svc.durationMinutes,
      addons: addonsByService[svc.id] ?? [],
    });
  }

  const dccSubs = await db.select({
    id: dcmsSubscriptionsTable.id,
    vehicleId: dcmsSubscriptionsTable.vehicleId,
    remainingWashes: dcmsSubscriptionsTable.remainingWashes,
    allocatedWashes: dcmsSubscriptionsTable.allocatedWashes,
    status: dcmsSubscriptionsTable.status,
    planName: dcmsPlansTable.name,
  })
    .from(dcmsSubscriptionsTable)
    .innerJoin(dcmsPlansTable, eq(dcmsSubscriptionsTable.planId, dcmsPlansTable.id))
    .where(and(
      eq(dcmsSubscriptionsTable.customerId, customerId),
      eq(dcmsSubscriptionsTable.status, "active"),
    ));

  const dccByVehicle: Record<number, {
    subscriptionId: number;
    remainingWashes: number;
    planName: string;
  }> = {};
  for (const sub of dccSubs) {
    if ((sub.allocatedWashes ?? 0) <= 0 || sub.remainingWashes <= 0) continue;
    dccByVehicle[sub.vehicleId] = {
      subscriptionId: sub.id,
      remainingWashes: sub.remainingWashes,
      planName: sub.planName,
    };
  }

  const openRows = await db.select().from(extraServiceRequestsTable)
    .where(and(
      eq(extraServiceRequestsTable.staffId, staffId),
      eq(extraServiceRequestsTable.customerId, customerId),
      inArray(extraServiceRequestsTable.status, OPEN_STATUSES),
    ))
    .orderBy(desc(extraServiceRequestsTable.createdAt));

  const staff = await loadStaff(staffId);
  const openRequests = await Promise.all(openRows.map(async row => toPublicView(row, {
    customerName: customer.name,
    staffName: staff.name,
  })));

  return {
    customer: { id: customer.id, name: customer.name },
    staff: { id: staff.id, name: staff.name },
    defaultVehicleId,
    dccSubscriptionId,
    vehicles,
    services,
    dccByVehicle,
    openRequests,
  };
}

async function quoteProposal(input: {
  vehicleId: number;
  serviceId: number;
  addonIds: number[];
  commercialSource: ExtraServiceCommercialSource;
}): Promise<{
  service: { id: number; name: string; price: number };
  addons: ExtraServicePublicAddon[];
  serviceAmount: number;
  addonAmount: number;
  amount: number;
}> {
  const [service] = await db.select().from(servicesTable)
    .where(and(
      eq(servicesTable.id, input.serviceId),
      eq(servicesTable.category, "car_wash"),
      eq(servicesTable.isActive, true),
    )).limit(1);
  if (!service) throw new Error("Select a Car Wash service");

  const quote = await quoteWashForVehicle(service.id, input.vehicleId);
  const serviceAmount = quote?.amount ?? toAmountNumber(service.basePrice);

  const addonIds = normalizeAddonIds(input.addonIds);
  let addons: ExtraServicePublicAddon[] = [];
  if (addonIds.length) {
    const rows = await db.select({ addon: serviceAddonsTable })
      .from(serviceAddonsTable)
      .innerJoin(serviceAddonLinksTable, eq(serviceAddonLinksTable.addonId, serviceAddonsTable.id))
      .where(and(
        inArray(serviceAddonsTable.id, addonIds),
        eq(serviceAddonsTable.isActive, true),
        eq(serviceAddonLinksTable.isActive, true),
        eq(serviceAddonLinksTable.serviceId, service.id),
      ));
    const found = new Set(rows.map(r => r.addon.id));
    if (found.size !== addonIds.length) throw new Error("One or more addons are not valid for this wash");
    addons = rows.map(r => ({
      id: r.addon.id,
      name: r.addon.name,
      price: toAmountNumber(r.addon.basePrice),
    }));
  }

  const addonAmount = addons.reduce((sum, a) => sum + a.price, 0);
  const washAmount = input.commercialSource === "DCC_INCLUDED" ? 0 : serviceAmount;
  return {
    service: { id: service.id, name: service.name, price: serviceAmount },
    addons,
    serviceAmount,
    addonAmount,
    amount: washAmount + addonAmount,
  };
}

export async function createExtraServiceRequest(
  req: Request,
  staffId: number,
  input: {
    customerId: number;
    vehicleId: number;
    serviceId: number;
    addonIds?: number[];
    commercialSource: ExtraServiceCommercialSource;
    dcmsSubscriptionId?: number | null;
  },
): Promise<ExtraServicePublicView> {
  const staff = await loadStaff(staffId);
  const customer = await loadCustomer(input.customerId);

  const [vehicle] = await db.select().from(vehiclesTable).where(and(
    eq(vehiclesTable.id, input.vehicleId),
    eq(vehiclesTable.customerId, customer.id),
  )).limit(1);
  if (!vehicle) throw new Error("Select a vehicle owned by this customer");

  if (input.commercialSource !== "DCC_INCLUDED" && input.commercialSource !== "PAID_EXTRA") {
    throw new Error("Select included wash or paid extra wash");
  }

  let dcmsSubscriptionId: number | null = null;
  let entitlementLabel: string | null = null;
  if (input.commercialSource === "DCC_INCLUDED") {
    const subId = input.dcmsSubscriptionId;
    if (!subId) throw new Error("Select the DCC plan to use an included wash");
    const [sub] = await db.select({
      id: dcmsSubscriptionsTable.id,
      customerId: dcmsSubscriptionsTable.customerId,
      vehicleId: dcmsSubscriptionsTable.vehicleId,
      remainingWashes: dcmsSubscriptionsTable.remainingWashes,
      allocatedWashes: dcmsSubscriptionsTable.allocatedWashes,
      status: dcmsSubscriptionsTable.status,
      planName: dcmsPlansTable.name,
    })
      .from(dcmsSubscriptionsTable)
      .innerJoin(dcmsPlansTable, eq(dcmsSubscriptionsTable.planId, dcmsPlansTable.id))
      .where(eq(dcmsSubscriptionsTable.id, subId))
      .limit(1);
    if (!sub || sub.customerId !== customer.id) throw new Error("Active daily plan not found");
    if (sub.vehicleId !== vehicle.id) throw new Error("Included wash must be used on the plan vehicle");
    if (sub.status !== "active" || (sub.allocatedWashes ?? 0) <= 0 || sub.remainingWashes <= 0) {
      throw new Error("No included wash remaining on this plan");
    }
    dcmsSubscriptionId = sub.id;
    entitlementLabel = `Use 1 included wash (${sub.remainingWashes} left on ${sub.planName})`;
  }

  const quote = await quoteProposal({
    vehicleId: vehicle.id,
    serviceId: input.serviceId,
    addonIds: input.addonIds ?? [],
    commercialSource: input.commercialSource,
  });
  const amount = normalizeAmount(quote.amount);
  const addonIds = normalizeAddonIds(input.addonIds);
  const fingerprint = extraServiceFingerprint({
    customerId: customer.id,
    staffId,
    vehicleId: vehicle.id,
    serviceId: quote.service.id,
    addonIds,
    amount,
    commercialSource: input.commercialSource,
    dcmsSubscriptionId,
  });

  const [existing] = await db.select().from(extraServiceRequestsTable)
    .where(and(
      eq(extraServiceRequestsTable.staffId, staffId),
      eq(extraServiceRequestsTable.customerId, customer.id),
      eq(extraServiceRequestsTable.requestFingerprint, fingerprint),
      inArray(extraServiceRequestsTable.status, OPEN_STATUSES),
    )).limit(1);
  if (existing) {
    return toPublicView(existing, { customerName: customer.name, staffName: staff.name });
  }

  const [anyOpen] = await db.select({ id: extraServiceRequestsTable.id, vehicleId: extraServiceRequestsTable.vehicleId })
    .from(extraServiceRequestsTable)
    .where(and(
      eq(extraServiceRequestsTable.staffId, staffId),
      eq(extraServiceRequestsTable.customerId, customer.id),
      eq(extraServiceRequestsTable.vehicleId, vehicle.id),
      inArray(extraServiceRequestsTable.status, OPEN_STATUSES),
    )).limit(1);
  if (anyOpen) {
    throw new Error("A request for this vehicle is already waiting for customer approval");
  }

  const snapshot: ExtraServiceConsentSnapshot = {
    staffName: staff.name,
    vehicleLabel: vehicleLabel(vehicle),
    vehicleRegistration: vehicle.registrationNumber,
    serviceName: quote.service.name,
    addonNames: quote.addons.map(a => a.name),
    amountDisplay: formatInr(amount),
    commercialSource: input.commercialSource,
    entitlementLabel,
  };

  const stamped = tenantStamp(req, {
    requestType: "extra_car_wash" as const,
    status: "pending_customer_approval" as const,
    customerId: customer.id,
    staffId,
    vehicleId: vehicle.id,
    serviceId: quote.service.id,
    addonIds,
    commercialSource: input.commercialSource,
    dcmsSubscriptionId,
    amount,
    requestFingerprint: fingerprint,
    consentSnapshot: snapshot,
    companyId: staff.companyId,
    franchiseeId: staff.franchiseeId,
    branchId: staff.branchId,
  });

  try {
    const [created] = await db.insert(extraServiceRequestsTable).values(stamped as never).returning();
    return toPublicView(created!, { customerName: customer.name, staffName: staff.name });
  } catch (err) {
    const [race] = await db.select().from(extraServiceRequestsTable)
      .where(and(
        eq(extraServiceRequestsTable.staffId, staffId),
        eq(extraServiceRequestsTable.customerId, customer.id),
        eq(extraServiceRequestsTable.requestFingerprint, fingerprint),
        inArray(extraServiceRequestsTable.status, OPEN_STATUSES),
      )).limit(1);
    if (race) return toPublicView(race, { customerName: customer.name, staffName: staff.name });
    throw err;
  }
}

export async function listStaffExtraServiceRequests(staffId: number, customerId?: number) {
  const conditions = [
    eq(extraServiceRequestsTable.staffId, staffId),
    inArray(extraServiceRequestsTable.status, [...OPEN_STATUSES, "otp_verified"]),
  ];
  if (customerId) conditions.push(eq(extraServiceRequestsTable.customerId, customerId));
  const rows = await db.select().from(extraServiceRequestsTable)
    .where(and(...conditions))
    .orderBy(desc(extraServiceRequestsTable.createdAt))
    .limit(20);
  return Promise.all(rows.map(async row => toPublicView(row, await namesFor(row))));
}

export async function listCustomerExtraServiceInbox(customerId: number): Promise<ExtraServicePublicView[]> {
  const rows = await db.select().from(extraServiceRequestsTable)
    .where(and(
      eq(extraServiceRequestsTable.customerId, customerId),
      inArray(extraServiceRequestsTable.status, OPEN_STATUSES),
    ))
    .orderBy(desc(extraServiceRequestsTable.createdAt));

  const now = new Date();
  const views: ExtraServicePublicView[] = [];
  for (const row of rows) {
    if (row.status === "customer_approved" && isOtpExpired(row.otpExpiresAt, now) && row.otpCode) {
      await db.update(extraServiceRequestsTable)
        .set({ otpCode: null, updatedAt: now })
        .where(eq(extraServiceRequestsTable.id, row.id));
      row.otpCode = null;
    }
    views.push(toPublicView(row, await namesFor(row), { includeOtp: true }));
  }
  return views;
}

export async function approveExtraServiceRequest(customerId: number, requestId: number): Promise<ExtraServicePublicView> {
  const [row] = await db.select().from(extraServiceRequestsTable)
    .where(and(
      eq(extraServiceRequestsTable.id, requestId),
      eq(extraServiceRequestsTable.customerId, customerId),
    )).limit(1);
  if (!row) throw new Error("Request not found");
  if (row.status === "rejected" || row.status === "cancelled") throw new Error("This request was rejected");
  if (row.status === "otp_verified") throw new Error("This request is already verified");

  const currentFingerprint = extraServiceFingerprint({
    customerId: row.customerId,
    staffId: row.staffId,
    vehicleId: row.vehicleId,
    serviceId: row.serviceId,
    addonIds: row.addonIds ?? [],
    amount: row.amount,
    commercialSource: row.commercialSource,
    dcmsSubscriptionId: row.dcmsSubscriptionId,
  });
  if (currentFingerprint !== row.requestFingerprint) {
    throw new Error("This request changed and needs a new approval");
  }

  if (row.status === "customer_approved" && row.otpCode && !isOtpExpired(row.otpExpiresAt)) {
    return toPublicView(row, await namesFor(row), { includeOtp: true });
  }

  const otp = generateExtraServiceOtp();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + EXTRA_SERVICE_OTP_TTL_MS);
  const otpCodeHash = extraServiceOtpBindingHash(otp, row.id, row.requestFingerprint);

  const [updated] = await db.update(extraServiceRequestsTable)
    .set({
      status: "customer_approved",
      customerApprovedAt: row.customerApprovedAt ?? now,
      otpCode: otp,
      otpCodeHash,
      otpExpiresAt: expiresAt,
      otpAttemptCount: 0,
      updatedAt: now,
    })
    .where(and(
      eq(extraServiceRequestsTable.id, row.id),
      eq(extraServiceRequestsTable.customerId, customerId),
      inArray(extraServiceRequestsTable.status, OPEN_STATUSES),
    ))
    .returning();
  if (!updated) throw new Error("Request could not be approved");
  return toPublicView(updated, await namesFor(updated), { includeOtp: true });
}

export async function rejectExtraServiceRequest(customerId: number, requestId: number): Promise<ExtraServicePublicView> {
  const now = new Date();
  const [updated] = await db.update(extraServiceRequestsTable)
    .set({
      status: "rejected",
      customerRejectedAt: now,
      otpCode: null,
      otpCodeHash: null,
      updatedAt: now,
    })
    .where(and(
      eq(extraServiceRequestsTable.id, requestId),
      eq(extraServiceRequestsTable.customerId, customerId),
      inArray(extraServiceRequestsTable.status, OPEN_STATUSES),
    ))
    .returning();
  if (!updated) throw new Error("Request not found or already closed");
  return toPublicView(updated, await namesFor(updated));
}

export async function verifyExtraServiceOtp(
  req: Request,
  staffId: number,
  requestId: number,
  code: string,
): Promise<ExtraServicePublicView> {
  const [row] = await db.select().from(extraServiceRequestsTable)
    .where(and(
      eq(extraServiceRequestsTable.id, requestId),
      eq(extraServiceRequestsTable.staffId, staffId),
    )).limit(1);
  if (!row) throw new Error("Request not found");
  if (row.status === "otp_verified") {
    if (!row.executionId) {
      await activateExtraCarWashJob(req, row);
      const [resumed] = await db.select().from(extraServiceRequestsTable)
        .where(eq(extraServiceRequestsTable.id, row.id)).limit(1);
      return toPublicView(resumed ?? row, await namesFor(row));
    }
    return toPublicView(row, await namesFor(row));
  }
  if (row.status !== "customer_approved") {
    throw new Error("Waiting for the customer to approve first");
  }
  if (isOtpExpired(row.otpExpiresAt)) {
    throw new Error("Verification code expired — ask the customer to approve again");
  }
  if (row.otpAttemptCount >= EXTRA_SERVICE_OTP_MAX_ATTEMPTS) {
    throw new Error("Too many incorrect codes — ask the customer to approve again");
  }

  const trimmed = code.trim();
  if (!/^\d{4}$/.test(trimmed)) throw new Error("Enter the 4-digit code");

  const expected = extraServiceOtpBindingHash(trimmed, row.id, row.requestFingerprint);
  if (!row.otpCodeHash || expected !== row.otpCodeHash) {
    await db.update(extraServiceRequestsTable)
      .set({
        otpAttemptCount: row.otpAttemptCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(extraServiceRequestsTable.id, row.id));
    throw new Error("Incorrect verification code");
  }

  const now = new Date();
  const [locked] = await db.update(extraServiceRequestsTable)
    .set({
      status: "otp_verified",
      otpVerifiedAt: now,
      otpVerifiedByStaffId: staffId,
      otpCode: null,
      otpCodeHash: row.otpCodeHash,
      updatedAt: now,
    })
    .where(and(
      eq(extraServiceRequestsTable.id, row.id),
      eq(extraServiceRequestsTable.status, "customer_approved"),
    ))
    .returning();

  if (!locked) {
    const [again] = await db.select().from(extraServiceRequestsTable)
      .where(eq(extraServiceRequestsTable.id, row.id)).limit(1);
    if (again?.status === "otp_verified") return toPublicView(again, await namesFor(again));
    throw new Error("This code was already used");
  }

  const activated = await activateExtraCarWashJob(req, locked);
  const [finalRow] = await db.select().from(extraServiceRequestsTable)
    .where(eq(extraServiceRequestsTable.id, locked.id)).limit(1);
  return toPublicView(finalRow ?? { ...locked, bookingId: activated.bookingId, executionId: activated.executionId }, await namesFor(locked));
}
