import { Router } from "express";
import { db } from "@workspace/db";
import { bookingsTable, customersTable, staffTable, servicesTable, bookingEventsTable, vehiclesTable, solarSitesTable, subscriptionsTable } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { tenantFilters, tenantStamp, rowInScope, loadIfInScope } from "../middlewares/tenantScope";
import { decrementOnCompletion, recomputeNextDueDate, getTodayIST, type Transaction } from "../subscriptions/service";
import { resolveBookingAmount } from "../lib/dynamicPricing";
import { staffAssignableError } from "../lib/staffEcosystem/profileCompletion";
import { roleSlugForBookingService, staffOperationalRoleError } from "../lib/staffEcosystem/operationalRoles";
import {
  debitWallet,
  resolveDailyRate,
  WalletError,
  getLedgerBalance,
  isLowBalance,
} from "../lib/wallet/service";
import { notifyBookingConfirmed, notifyBookingCompleted, notifyLowBalance } from "../lib/notifications/dispatcher";
import { captureBookingTransitionLocation } from "../lib/staffLocation/bookingLocation";
import { handleLocationError } from "../lib/staffLocation/locationService";

const router = Router();

async function validateStaffAssignmentForService(
  staff: typeof staffTable.$inferSelect,
  serviceType: string,
): Promise<string | null> {
  const roleSlug = roleSlugForBookingService(serviceType);
  if (!roleSlug) return staffAssignableError(staff);
  return staffOperationalRoleError(staff, roleSlug);
}

const SCOPE_COLS = {
  companyCol: bookingsTable.companyId,
  branchCol: bookingsTable.branchId,
  franchiseeCol: bookingsTable.franchiseeId,
  customerCol: bookingsTable.customerId,
  staffCol: bookingsTable.staffId,
};

const bookingSelect = {
  id: bookingsTable.id,
  customerId: bookingsTable.customerId,
  customerName: customersTable.name,
  customerPhone: customersTable.phone,
  vehicleId: bookingsTable.vehicleId,
  solarSiteId: bookingsTable.solarSiteId,
  subscriptionId: bookingsTable.subscriptionId,
  serviceId: bookingsTable.serviceId,
  serviceName: servicesTable.name,
  staffId: bookingsTable.staffId,
  staffName: staffTable.name,
  branchId: bookingsTable.branchId,
  companyId: bookingsTable.companyId,
  franchiseeId: bookingsTable.franchiseeId,
  scheduledDate: bookingsTable.scheduledDate,
  scheduledTime: bookingsTable.scheduledTime,
  status: bookingsTable.status,
  serviceType: bookingsTable.serviceType,
  address: bookingsTable.address,
  area: bookingsTable.area,
  locationLat: bookingsTable.locationLat,
  locationLng: bookingsTable.locationLng,
  placeId: bookingsTable.placeId,
  savedLocationId: bookingsTable.savedLocationId,
  notes: bookingsTable.notes,
  startedAt: bookingsTable.startedAt,
  completedAt: bookingsTable.completedAt,
  cancellationReason: bookingsTable.cancellationReason,
  proofPhotoUrls: bookingsTable.proofPhotoUrls,
  customerSignatureUrl: bookingsTable.customerSignatureUrl,
  beforePhotoUrl: bookingsTable.beforePhotoUrl,
  afterPhotoUrl: bookingsTable.afterPhotoUrl,
  technicianNotes: bookingsTable.technicianNotes,
  rating: bookingsTable.rating,
  amount: bookingsTable.amount,
  recurrenceRule: bookingsTable.recurrenceRule,
  parentBookingId: bookingsTable.parentBookingId,
  createdAt: bookingsTable.createdAt,
};

const allowedTransitions: Record<string, string[]> = {
  scheduled: ["en_route", "cancelled", "rescheduled"],
  en_route: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  rescheduled: ["en_route", "cancelled"],
  pending: ["confirmed", "cancelled"],
  confirmed: ["scheduled", "cancelled"],
};

async function logEvent(
  bookingId: number,
  type: string,
  opts?: { fromStatus?: string; toStatus?: string; body?: string; actorId?: number | null; actorName?: string; locationLat?: string; locationLng?: string },
  tx?: any,
) {
  const ctx = tx ?? db;
  await ctx.insert(bookingEventsTable).values({
    bookingId,
    type: type as any,
    fromStatus: opts?.fromStatus ?? null,
    toStatus: opts?.toStatus ?? null,
    body: opts?.body ?? null,
    actorId: opts?.actorId ?? null,
    actorName: opts?.actorName ?? null,
    locationLat: opts?.locationLat ?? null,
    locationLng: opts?.locationLng ?? null,
  });
}

async function getBookingWithScope(req: any, id: number) {
  const [booking] = await db.select(bookingSelect).from(bookingsTable)
    .leftJoin(customersTable, eq(bookingsTable.customerId, customersTable.id))
    .leftJoin(staffTable, eq(bookingsTable.staffId, staffTable.id))
    .leftJoin(servicesTable, eq(bookingsTable.serviceId, servicesTable.id))
    .where(eq(bookingsTable.id, id));
  if (!booking || !rowInScope(req, booking)) return null;
  return booking;
}

async function shouldDebitDailyCleaning(
  booking: { serviceType: string; subscriptionId?: number | null; amount?: string | null },
  tx: Transaction,
): Promise<{ debit: boolean; dailyRate: number; subscriptionId?: number }> {
  if (booking.serviceType === "daily_cleaning") {
    if (booking.subscriptionId) {
      const amount = await resolveSubscriptionDailyRate(booking.subscriptionId, tx);
      if (amount != null) return { debit: true, dailyRate: amount, subscriptionId: booking.subscriptionId };
    }
    if (booking.amount && parseFloat(booking.amount) > 0) {
      return { debit: true, dailyRate: parseFloat(booking.amount) };
    }
    return { debit: false, dailyRate: 0 };
  }
  if (booking.subscriptionId) {
    const [sub] = await tx.select().from(subscriptionsTable)
      .where(eq(subscriptionsTable.id, booking.subscriptionId)).limit(1);
    if (sub?.type === "daily_wash" && sub.status === "active") {
      return { debit: true, dailyRate: resolveDailyRate(sub), subscriptionId: sub.id };
    }
  }
  return { debit: false, dailyRate: 0 };
}

async function resolveSubscriptionDailyRate(subscriptionId: number, tx: Transaction): Promise<number | null> {
  const [sub] = await tx.select().from(subscriptionsTable)
    .where(eq(subscriptionsTable.id, subscriptionId)).limit(1);
  if (!sub || sub.type !== "daily_wash") return null;
  return resolveDailyRate(sub);
}

router.get("/bookings/today", async (req, res) => {
  try {
    const { staffId, branchId } = req.query as Record<string, string>;
    const today = getTodayIST();
    const conditions = [
      ...tenantFilters(req, SCOPE_COLS),
      sql`${bookingsTable.scheduledDate}::text = ${today}`,
    ];
    if (staffId) conditions.push(eq(bookingsTable.staffId, parseInt(staffId)));
    if (branchId) conditions.push(eq(bookingsTable.branchId, parseInt(branchId)));

    const data = await db.select(bookingSelect).from(bookingsTable)
      .leftJoin(customersTable, eq(bookingsTable.customerId, customersTable.id))
      .leftJoin(staffTable, eq(bookingsTable.staffId, staffTable.id))
      .leftJoin(servicesTable, eq(bookingsTable.serviceId, servicesTable.id))
      .where(and(...conditions))
      .orderBy(bookingsTable.scheduledTime);

    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "Today bookings error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/bookings", async (req, res) => {
  try {
    const { customerId, staffId, date, status, serviceType, limit = "50", offset = "0" } = req.query as Record<string, string>;
    const lim = Math.min(parseInt(limit), 100);
    const off = parseInt(offset);

    const conditions = [...tenantFilters(req, SCOPE_COLS)];
    if (customerId) conditions.push(eq(bookingsTable.customerId, parseInt(customerId)));
    if (staffId) conditions.push(eq(bookingsTable.staffId, parseInt(staffId)));
    if (date) conditions.push(sql`${bookingsTable.scheduledDate}::text = ${date}`);
    if (status) conditions.push(eq(bookingsTable.status, status as any));
    if (serviceType) conditions.push(eq(bookingsTable.serviceType, serviceType as any));

    const where = conditions.length ? and(...conditions) : undefined;

    const [data, countResult] = await Promise.all([
      db.select(bookingSelect).from(bookingsTable)
        .leftJoin(customersTable, eq(bookingsTable.customerId, customersTable.id))
        .leftJoin(staffTable, eq(bookingsTable.staffId, staffTable.id))
        .leftJoin(servicesTable, eq(bookingsTable.serviceId, servicesTable.id))
        .where(where).orderBy(desc(bookingsTable.createdAt)).limit(lim).offset(off),
      db.select({ count: sql<number>`count(*)` }).from(bookingsTable).where(where),
    ]);

    return res.json({ data, total: Number(countResult[0]?.count ?? 0), limit: lim, offset: off });
  } catch (err) {
    req.log.error({ err }, "List bookings error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bookings", async (req, res) => {
  try {
    const {
      customerId, vehicleId, solarSiteId, subscriptionId, serviceId, staffId, branchId,
      scheduledDate, scheduledTime, serviceType, address, area, locationLat, locationLng,
      placeId, savedLocationId, notes, amount, recurrenceRule,
      entitlementId, addonIds, cityId, citySlug,
    } = req.body;
    if (!customerId || !scheduledDate || !serviceType) {
      return res.status(400).json({ error: "customerId, scheduledDate, and serviceType are required" });
    }
    if (!address || locationLat == null || locationLng == null) {
      return res.status(400).json({ error: "address, locationLat, and locationLng are required for doorstep service" });
    }

    const customer = await loadIfInScope(req,
      () => db.select().from(customersTable).where(eq(customersTable.id, customerId)).limit(1).then(r => r[0]),
      r => ({ ...r, customerId: r.id }),
    );
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    if (staffId) {
      const staff = await loadIfInScope(req,
        () => db.select().from(staffTable).where(eq(staffTable.id, staffId)).limit(1).then(r => r[0]),
        r => ({ ...r, staffId: r.id }),
      );
      if (!staff) return res.status(404).json({ error: "Staff not found" });
      const assignErr = await validateStaffAssignmentForService(staff, serviceType);
      if (assignErr) return res.status(409).json({ error: assignErr });
    }

    if (vehicleId) {
      const [vehicle] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, vehicleId)).limit(1);
      if (!vehicle || vehicle.customerId !== customerId) {
        return res.status(400).json({ error: "Vehicle not found for this customer" });
      }
      if (!vehicle.locationComplete) {
        return res.status(400).json({ error: "Vehicle must have a service location before booking" });
      }
    }

    if (solarSiteId) {
      const [site] = await db.select().from(solarSitesTable).where(eq(solarSitesTable.id, solarSiteId)).limit(1);
      if (!site || site.customerId !== customerId) {
        return res.status(400).json({ error: "Solar site not found for this customer" });
      }
      if (!site.locationComplete) {
        return res.status(400).json({ error: "Solar site must have a service location before booking" });
      }
    }

    let resolvedAmount = amount?.toString();
    const resolvedBranchId = branchId ?? customer.branchId ?? undefined;
    let resolvedEntitlementId: number | null = entitlementId ?? null;
    let resolvedCityId: number | null = cityId ?? null;

    if (serviceId && customerId && !resolvedEntitlementId) {
      const { checkSelfBookingEligibility } = await import("../lib/catalog/entitlementEngine");
      const { resolveCityId } = await import("../lib/catalog/pricingEngine");
      const cid = resolvedCityId ?? (citySlug ? await resolveCityId(citySlug) : null);
      const eligibility = await checkSelfBookingEligibility({
        customerId, serviceId, cityId: cid,
      });
      if (eligibility.eligible && eligibility.entitlementId) {
        resolvedEntitlementId = eligibility.entitlementId;
      }
    }

    if (resolvedEntitlementId) {
      const { customerEntitlementsTable } = await import("@workspace/db");
      const { gt: gtOp } = await import("drizzle-orm");
      const today = getTodayIST();
      const [ent] = await db.select().from(customerEntitlementsTable)
        .where(and(
          eq(customerEntitlementsTable.id, resolvedEntitlementId),
          eq(customerEntitlementsTable.customerId, customerId),
          eq(customerEntitlementsTable.status, "active"),
          gtOp(customerEntitlementsTable.remainingCredits, 0),
        ))
        .limit(1);
      if (!ent || ent.validUntil < today) {
        return res.status(400).json({ error: "Invalid or expired entitlement for this booking" });
      }
    }

    if (!resolvedAmount) {
      const panelCount = solarSiteId
        ? (await db.select({ panelCount: solarSitesTable.panelCount }).from(solarSitesTable)
            .where(eq(solarSitesTable.id, solarSiteId)).limit(1))[0]?.panelCount
        : undefined;
      const computed = await resolveBookingAmount({
        serviceId, vehicleId, solarSiteId, serviceType, panelCount,
        cityId: resolvedCityId, citySlug,
      });
      if (computed != null) resolvedAmount = String(computed);
    }

    if (resolvedEntitlementId) {
      resolvedAmount = "0";
    }

    if (Array.isArray(addonIds) && addonIds.length > 0) {
      const { serviceAddonsTable } = await import("@workspace/db");
      const { inArray } = await import("drizzle-orm");
      const addons = await db.select().from(serviceAddonsTable)
        .where(and(inArray(serviceAddonsTable.id, addonIds), eq(serviceAddonsTable.isActive, true)));
      const addonTotal = addons.reduce((sum, a) => sum + parseFloat(a.basePrice), 0);
      resolvedAmount = String(parseFloat(resolvedAmount ?? "0") + addonTotal);
    }

    const initialStatus = req.user?.role === "customer" ? "pending" as const : "scheduled" as const;

    const values = tenantStamp(req, {
      customerId, vehicleId, solarSiteId, subscriptionId, serviceId, staffId,
      branchId: resolvedBranchId,
      scheduledDate, scheduledTime, serviceType, address, area, locationLat, locationLng,
      placeId, savedLocationId, notes,
      amount: resolvedAmount,
      recurrenceRule,
      entitlementId: resolvedEntitlementId,
      addonIds: Array.isArray(addonIds) ? addonIds : [],
      cityId: resolvedCityId,
      status: initialStatus,
    });
    const [booking] = await db.insert(bookingsTable).values(values as any).returning();
    return res.status(201).json(booking);
  } catch (err) {
    req.log.error({ err }, "Create booking error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/bookings/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const booking = await getBookingWithScope(req, id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    return res.json(booking);
  } catch (err) {
    req.log.error({ err }, "Get booking error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/bookings/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, existing)) {
      return res.status(404).json({ error: "Booking not found" });
    }
    const { status, staffId, scheduledDate, scheduledTime, notes, technicianNotes, beforePhotoUrl, afterPhotoUrl, proofPhotoUrls, customerSignatureUrl, cancellationReason, rating, completedAt } = req.body;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (status !== undefined) updateData.status = status;
    if (staffId !== undefined) {
      if (staffId === null) {
        updateData.staffId = null;
      } else {
        const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, staffId)).limit(1);
        if (!staff) return res.status(404).json({ error: "Staff not found" });
        const assignErr = await validateStaffAssignmentForService(staff, existing.serviceType);
        if (assignErr) return res.status(409).json({ error: assignErr });
        updateData.staffId = staffId;
      }
    }
    if (scheduledDate !== undefined) updateData.scheduledDate = scheduledDate;
    if (scheduledTime !== undefined) updateData.scheduledTime = scheduledTime;
    if (notes !== undefined) updateData.notes = notes;
    if (technicianNotes !== undefined) updateData.technicianNotes = technicianNotes;
    if (beforePhotoUrl !== undefined) updateData.beforePhotoUrl = beforePhotoUrl;
    if (afterPhotoUrl !== undefined) updateData.afterPhotoUrl = afterPhotoUrl;
    if (proofPhotoUrls !== undefined) updateData.proofPhotoUrls = proofPhotoUrls;
    if (customerSignatureUrl !== undefined) updateData.customerSignatureUrl = customerSignatureUrl;
    if (cancellationReason !== undefined) updateData.cancellationReason = cancellationReason;
    if (rating !== undefined) updateData.rating = rating;
    if (completedAt !== undefined) updateData.completedAt = new Date(completedAt);
    if (status === "completed" && !completedAt) updateData.completedAt = new Date();

    const [booking] = await db.update(bookingsTable).set(updateData).where(eq(bookingsTable.id, id)).returning();

    if (beforePhotoUrl !== undefined) {
      await logEvent(id, "proof_upload", {
        body: "Before photo uploaded",
        actorId: req.user?.id ?? req.scope?.staffId,
        actorName: req.user?.name ?? "system",
      });
    }
    if (afterPhotoUrl !== undefined) {
      await logEvent(id, "proof_upload", {
        body: "After photo uploaded",
        actorId: req.user?.id ?? req.scope?.staffId,
        actorName: req.user?.name ?? "system",
      });
    }

    return res.json(booking);
  } catch (err) {
    req.log.error({ err }, "Update booking error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bookings/:id/transition", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { toStatus, reason } = req.body;
    const [existing] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, existing)) return res.status(404).json({ error: "Booking not found" });
    if (!toStatus) return res.status(400).json({ error: "toStatus is required" });

    const allowed = allowedTransitions[existing.status] || [];
    if (!allowed.includes(toStatus)) {
      return res.status(400).json({ error: `Invalid transition from ${existing.status} to ${toStatus}` });
    }

    if (toStatus === "in_progress" && !existing.beforePhotoUrl) {
      return res.status(400).json({ error: "Upload a before photo before starting the job" });
    }
    if (toStatus === "completed" && !existing.afterPhotoUrl) {
      return res.status(400).json({ error: "Upload an after photo before completing the job" });
    }

    const isAssignedStaff =
      req.user?.staffId != null
      && existing.staffId != null
      && req.user.staffId === existing.staffId;
    const locationRequired = isAssignedStaff && ["en_route", "in_progress", "completed"].includes(toStatus);

    let locationLog: Awaited<ReturnType<typeof captureBookingTransitionLocation>> = null;
    try {
      locationLog = await captureBookingTransitionLocation(
        existing,
        existing.staffId!,
        toStatus,
        req.body as Record<string, unknown>,
        { requireLocation: locationRequired },
      );
    } catch (locErr) {
      const handled = handleLocationError(locErr);
      if (handled) return res.status(handled.status).json(handled.body);
      throw locErr;
    }

    const updateData: Record<string, unknown> = { status: toStatus, updatedAt: new Date() };
    if (toStatus === "in_progress") updateData.startedAt = new Date();
    if (toStatus === "completed") updateData.completedAt = new Date();

    const eventLocation = locationLog
      ? { locationLat: String(locationLog.latitude), locationLng: String(locationLog.longitude) }
      : undefined;

    if (toStatus === "completed") {
      const fullBooking = await getBookingWithScope(req, id);
      if (!fullBooking) return res.status(404).json({ error: "Booking not found" });

      try {
        let completionDailyRate = 0;
        const booking = await db.transaction(async (tx) => {
          const debitInfo = await shouldDebitDailyCleaning(existing, tx);
          completionDailyRate = debitInfo.dailyRate;
          if (debitInfo.debit) {
            await debitWallet({
              customerId: existing.customerId,
              amount: debitInfo.dailyRate,
              reference: "daily_cleaning",
              referenceId: id,
              notes: `Daily cleaning booking #${id}`,
              createdBy: req.user?.id ?? null,
              companyId: existing.companyId,
            }, tx);
          }

          const [b] = await tx.update(bookingsTable).set(updateData).where(eq(bookingsTable.id, id)).returning();
          await logEvent(id, "status_change", {
            fromStatus: existing.status,
            toStatus,
            body: reason,
            actorId: req.user?.id ?? req.scope?.staffId,
            actorName: req.user?.name ?? "system",
            ...eventLocation,
          }, tx);

          if (existing.subscriptionId) {
            const subId = existing.subscriptionId as number;
            await decrementOnCompletion(subId, tx);
            const { recomputeServicesRemaining } = await import("../subscriptions/service");
            await recomputeNextDueDate(subId, tx);
            await recomputeServicesRemaining(subId, tx);
          }

          if (existing.entitlementId) {
            const { consumeEntitlementOnCompletion } = await import("../lib/catalog/entitlementEngine");
            await consumeEntitlementOnCompletion(existing.entitlementId as number, id, 1, tx);
          }

          return b;
        });

        notifyBookingCompleted({
          id: booking.id,
          customerId: booking.customerId,
          customerName: fullBooking.customerName,
          serviceName: fullBooking.serviceName,
          serviceType: fullBooking.serviceType,
          scheduledDate: String(fullBooking.scheduledDate),
          companyId: fullBooking.companyId,
          branchId: fullBooking.branchId,
        }).catch((err) => req.log.error({ err, bookingId: id }, "Completion notification failed"));

        if (existing.subscriptionId || existing.serviceType === "daily_cleaning") {
          const dailyRate = completionDailyRate > 0 ? completionDailyRate : parseFloat(existing.amount ?? "0");
          if (dailyRate > 0) {
            const balance = await getLedgerBalance(existing.customerId);
            if (await isLowBalance(existing.customerId, dailyRate)) {
              notifyLowBalance({
                customerId: existing.customerId,
                customerName: fullBooking.customerName ?? "Customer",
                balance,
                dailyRate,
                companyId: fullBooking.companyId,
                branchId: fullBooking.branchId,
                dedupeKey: `low_balance:${existing.customerId}:${getTodayIST()}`,
              }).catch((err) => req.log.error({ err }, "Low balance notify failed"));
            }
          }
        }

        return res.json(booking);
      } catch (err) {
        if (err instanceof WalletError && err.code === "INSUFFICIENT_BALANCE") {
          return res.status(400).json({ error: err.message, code: err.code });
        }
        throw err;
      }
    }

    if (toStatus === "confirmed") {
      const [booking] = await db.update(bookingsTable).set(updateData).where(eq(bookingsTable.id, id)).returning();
      await logEvent(id, "status_change", {
        fromStatus: existing.status,
        toStatus,
        body: reason,
        actorId: req.user?.id ?? req.scope?.staffId,
        actorName: req.user?.name ?? "system",
      });

      const fullBooking = await getBookingWithScope(req, id);
      if (fullBooking) {
        notifyBookingConfirmed({
          id: fullBooking.id,
          customerId: fullBooking.customerId,
          customerName: fullBooking.customerName,
          serviceName: fullBooking.serviceName,
          serviceType: fullBooking.serviceType,
          scheduledDate: String(fullBooking.scheduledDate),
          companyId: fullBooking.companyId,
          branchId: fullBooking.branchId,
        }).catch((err) => req.log.error({ err, bookingId: id }, "Confirmation notification failed"));
      }

      return res.json(booking);
    }

    const [booking] = await db.update(bookingsTable).set(updateData).where(eq(bookingsTable.id, id)).returning();
    await logEvent(id, "status_change", {
      fromStatus: existing.status,
      toStatus,
      body: reason,
      actorId: req.user?.id ?? req.scope?.staffId,
      actorName: req.user?.name ?? "system",
      ...eventLocation,
    });

    return res.json(booking);
  } catch (err) {
    req.log.error({ err }, "Transition booking error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bookings/:id/proof", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { urls } = req.body as { urls: string[] };
    const [existing] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, existing)) return res.status(404).json({ error: "Booking not found" });
    if (!Array.isArray(urls) || urls.length === 0) return res.status(400).json({ error: "urls array required" });

    const current = (existing.proofPhotoUrls as string[] | null) ?? [];
    const updated = [...current, ...urls];
    const [booking] = await db.update(bookingsTable).set({ proofPhotoUrls: updated, updatedAt: new Date() }).where(eq(bookingsTable.id, id)).returning();
    await logEvent(id, "proof_upload", {
      body: `${urls.length} photo(s) added`,
      actorId: req.user?.id ?? req.scope?.staffId,
      actorName: req.user?.name ?? "system",
    });
    return res.json(booking);
  } catch (err) {
    req.log.error({ err }, "Proof upload error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bookings/:id/assign", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { staffId, reason } = req.body;
    const [existing] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, existing)) return res.status(404).json({ error: "Booking not found" });
    if (!staffId) return res.status(400).json({ error: "staffId is required" });

    const staff = await loadIfInScope(req,
      () => db.select().from(staffTable).where(eq(staffTable.id, staffId)).limit(1).then(r => r[0]),
      r => ({ ...r, staffId: r.id }),
    );
    if (!staff) return res.status(404).json({ error: "Staff not found" });
    const assignErr = await validateStaffAssignmentForService(staff, existing.serviceType);
    if (assignErr) return res.status(409).json({ error: assignErr });
    if (staff.verificationStatus !== "verified") {
      return res.status(400).json({ error: "Staff must be verified before assignment" });
    }

    const [booking] = await db.update(bookingsTable).set({ staffId, updatedAt: new Date() }).where(eq(bookingsTable.id, id)).returning();
    await logEvent(id, "reassign", {
      body: reason ?? `Assigned to staff ${staffId}`,
      actorId: req.user?.id ?? req.scope?.staffId,
      actorName: req.user?.name ?? "system",
    });
    return res.json(booking);
  } catch (err) {
    req.log.error({ err }, "Assign booking error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bookings/:id/reschedule", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { scheduledDate, scheduledTime, reason } = req.body;
    const [existing] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, existing)) return res.status(404).json({ error: "Booking not found" });
    if (!scheduledDate) return res.status(400).json({ error: "scheduledDate is required" });

    const [booking] = await db.update(bookingsTable).set({
      scheduledDate, scheduledTime: scheduledTime ?? null, status: "rescheduled", updatedAt: new Date(),
    }).where(eq(bookingsTable.id, id)).returning();
    await logEvent(id, "reschedule", {
      body: reason ?? `Rescheduled to ${scheduledDate}`,
      actorId: req.user?.id ?? req.scope?.staffId,
      actorName: req.user?.name ?? "system",
    });
    return res.json(booking);
  } catch (err) {
    req.log.error({ err }, "Reschedule booking error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bookings/:id/regenerate-occurrences", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, existing)) return res.status(404).json({ error: "Booking not found" });
    if (!existing.recurrenceRule) return res.status(400).json({ error: "Booking has no recurrenceRule" });

    const rule = existing.recurrenceRule as string;
    const days = parseInt(rule.match(/\d+/)?.[0] ?? "7");
    const count = parseInt(rule.match(/count=(\d+)/)?.[1] ?? "4");
    const startDate = new Date(existing.scheduledDate);

    const createdIds: number[] = [];
    for (let i = 1; i <= count; i++) {
      const nextDate = new Date(startDate);
      nextDate.setDate(nextDate.getDate() + days * i);
      const nextDateStr = getTodayIST(nextDate);

      const dup = tenantStamp(req, {
        customerId: existing.customerId,
        vehicleId: existing.vehicleId,
        solarSiteId: existing.solarSiteId,
        subscriptionId: existing.subscriptionId,
        serviceId: existing.serviceId,
        staffId: existing.staffId,
        branchId: existing.branchId,
        companyId: existing.companyId,
        franchiseeId: existing.franchiseeId,
        scheduledDate: nextDateStr,
        scheduledTime: existing.scheduledTime,
        serviceType: existing.serviceType,
        address: existing.address,
        area: existing.area,
        notes: existing.notes,
        amount: existing.amount,
        parentBookingId: existing.id,
        status: "scheduled" as const,
      });
      const [child] = await db.insert(bookingsTable).values(dup as any).returning();
      createdIds.push(child.id);
    }

    return res.json({ created: createdIds.length, bookingIds: createdIds });
  } catch (err) {
    req.log.error({ err }, "Regenerate occurrences error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/bookings/:id/events", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id)).limit(1);
    if (!booking || !rowInScope(req, booking)) return res.status(404).json({ error: "Booking not found" });

    const data = await db.select().from(bookingEventsTable).where(eq(bookingEventsTable.bookingId, id)).orderBy(desc(bookingEventsTable.createdAt));
    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "Get booking events error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
