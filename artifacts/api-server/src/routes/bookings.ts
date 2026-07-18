/**
 * Phase 5.2 Booking Engine routes — schedule only.
 * Owns: create, confirm, reschedule, cancel, slots, list/detail, timeline.
 * Does NOT own: pricing, staff assignment, proof photos, job completion, invoices.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import {
  bookingsTable,
  customersTable,
  servicesTable,
  bookingEventsTable,
  vehiclesTable,
  solarSitesTable,
  type BookingStatus,
} from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { tenantFilters, tenantStamp, rowInScope, loadIfInScope } from "../middlewares/tenantScope";
import { getTodayIST } from "../subscriptions/service";
import { isDailyCleanCatalogServiceName } from "../lib/dcms/dailyCleanCatalogGuard";
import {
  serviceabilityBlockedLogPayload,
  serviceabilityHttpBody,
  SERVICEABILITY_HTTP_STATUS,
} from "../lib/serviceability";
import {
  bookingCapability,
  BookingCoverageError,
  BookingValidationError,
  resolveBookingTraceId,
  BOOKING_TRANSITIONS,
} from "../lib/booking";

const router = Router();

const SCOPE_COLS = {
  companyCol: bookingsTable.companyId,
  branchCol: bookingsTable.branchId,
  franchiseeCol: bookingsTable.franchiseeId,
  customerCol: bookingsTable.customerId,
};

const bookingSelect = {
  id: bookingsTable.id,
  customerId: bookingsTable.customerId,
  customerName: customersTable.name,
  customerPhone: customersTable.phone,
  contractRegistryId: bookingsTable.contractRegistryId,
  serviceLocationId: bookingsTable.serviceLocationId,
  assetId: bookingsTable.assetId,
  vehicleId: bookingsTable.vehicleId,
  solarSiteId: bookingsTable.solarSiteId,
  serviceId: bookingsTable.serviceId,
  serviceName: servicesTable.name,
  branchId: bookingsTable.branchId,
  companyId: bookingsTable.companyId,
  franchiseeId: bookingsTable.franchiseeId,
  cityId: bookingsTable.cityId,
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
  addressSnapshotId: bookingsTable.addressSnapshotId,
  addressIdentityId: bookingsTable.addressIdentityId,
  notes: bookingsTable.notes,
  cancellationReason: bookingsTable.cancellationReason,
  customerConfirmedAt: bookingsTable.customerConfirmedAt,
  createdAt: bookingsTable.createdAt,
  updatedAt: bookingsTable.updatedAt,
};

async function logEvent(
  bookingId: number,
  type: string,
  opts?: {
    fromStatus?: string;
    toStatus?: string;
    body?: string;
    actorId?: number | null;
    actorName?: string;
  },
) {
  await db.insert(bookingEventsTable).values({
    bookingId,
    type: type as never,
    fromStatus: opts?.fromStatus ?? null,
    toStatus: opts?.toStatus ?? null,
    body: opts?.body ?? null,
    actorId: opts?.actorId ?? null,
    actorName: opts?.actorName ?? null,
  });
}

async function getBookingWithScope(req: Parameters<typeof rowInScope>[0], id: number) {
  const [booking] = await db.select(bookingSelect).from(bookingsTable)
    .leftJoin(customersTable, eq(bookingsTable.customerId, customersTable.id))
    .leftJoin(servicesTable, eq(bookingsTable.serviceId, servicesTable.id))
    .where(eq(bookingsTable.id, id));
  if (!booking || !rowInScope(req, booking)) return null;
  return booking;
}

router.get("/bookings/slots", async (req, res) => {
  try {
    const { date, branchId, assetId, serviceLocationId, customerId, durationMinutes } = req.query as Record<string, string>;
    if (!date) return res.status(400).json({ error: "date is required (YYYY-MM-DD)" });

    const slots = await bookingCapability.getSlots({
      date,
      branchId: branchId ? parseInt(branchId, 10) : undefined,
      assetId: assetId ? parseInt(assetId, 10) : undefined,
      serviceLocationId: serviceLocationId ? parseInt(serviceLocationId, 10) : undefined,
      customerId: customerId ? parseInt(customerId, 10) : undefined,
      durationMinutes: durationMinutes ? parseInt(durationMinutes, 10) : undefined,
    });
    return res.json({ date, slots });
  } catch (err) {
    req.log.error({ err }, "Get booking slots error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/bookings/today", async (req, res) => {
  try {
    const { branchId } = req.query as Record<string, string>;
    const today = getTodayIST();
    const conditions = [
      ...tenantFilters(req, SCOPE_COLS),
      sql`${bookingsTable.scheduledDate}::text = ${today}`,
    ];
    if (branchId) conditions.push(eq(bookingsTable.branchId, parseInt(branchId, 10)));

    const data = await db.select(bookingSelect).from(bookingsTable)
      .leftJoin(customersTable, eq(bookingsTable.customerId, customersTable.id))
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
    const {
      customerId, date, status, serviceType, limit = "50", offset = "0",
    } = req.query as Record<string, string>;
    const lim = Math.min(parseInt(limit, 10), 100);
    const off = parseInt(offset, 10);

    const conditions = [...tenantFilters(req, SCOPE_COLS)];
    if (customerId) conditions.push(eq(bookingsTable.customerId, parseInt(customerId, 10)));
    if (date) conditions.push(sql`${bookingsTable.scheduledDate}::text = ${date}`);
    if (status) conditions.push(eq(bookingsTable.status, status as BookingStatus));
    if (serviceType) conditions.push(eq(bookingsTable.serviceType, serviceType as never));

    const includeLegacyDaily = req.query.includeLegacyDaily === "true";
    if (!includeLegacyDaily) {
      conditions.push(sql`${bookingsTable.serviceType} <> 'daily_cleaning'`);
    }

    const where = conditions.length ? and(...conditions) : undefined;

    const [data, countResult] = await Promise.all([
      db.select(bookingSelect).from(bookingsTable)
        .leftJoin(customersTable, eq(bookingsTable.customerId, customersTable.id))
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
      customerId, vehicleId, solarSiteId, serviceId, branchId,
      scheduledDate, scheduledTime, serviceType, address, area, locationLat, locationLng,
      placeId, savedLocationId, notes, cityId, citySlug, assetId, serviceLocationId,
      contractRegistryId, addressId,
    } = req.body;

    if (!customerId || !scheduledDate || !serviceType) {
      return res.status(400).json({ error: "customerId, scheduledDate, and serviceType are required" });
    }
    if (!address || locationLat == null || locationLng == null) {
      return res.status(400).json({ error: "address, locationLat, and locationLng are required for doorstep service" });
    }

    const customer = await loadIfInScope(req,
      () => db.select().from(customersTable).where(eq(customersTable.id, customerId)).limit(1).then((r) => r[0]),
      (r) => ({ ...r, customerId: r.id }),
    );
    if (!customer) return res.status(404).json({ error: "Customer not found" });

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

    if (serviceId) {
      const [svc] = await db.select({ name: servicesTable.name }).from(servicesTable)
        .where(eq(servicesTable.id, serviceId)).limit(1);
      if (svc && isDailyCleanCatalogServiceName(svc.name)) {
        return res.status(400).json({
          error: "Daily cleaning is sold via monthly DCMS plans. Use Book Service → Plan, not one-time catalog service.",
        });
      }
    }

    const initialStatus: BookingStatus = req.user?.role === "customer" ? "draft" : "scheduled";
    const resolvedBranchId = branchId ?? customer.branchId ?? undefined;
    const tenantValues = tenantStamp(req, {});
    const traceId = resolveBookingTraceId(req.headers["x-trace-id"] ?? req.headers["x-request-id"]);

    try {
      const createResult = await bookingCapability.createBooking({
        customerId,
        contractRegistryId: contractRegistryId ?? null,
        serviceLocationId: serviceLocationId ?? null,
        assetId: assetId ?? null,
        vehicleId,
        solarSiteId,
        serviceId,
        branchId: resolvedBranchId,
        companyId: tenantValues.companyId,
        franchiseeId: tenantValues.franchiseeId,
        scheduledDate,
        scheduledTime,
        serviceType,
        address,
        area,
        locationLat,
        locationLng,
        placeId,
        savedLocationId,
        addressId,
        notes,
        cityId: cityId ?? null,
        citySlug,
        cityName: typeof area === "string" ? area : undefined,
        status: initialStatus,
      }, {
        traceId,
        requestId: String(req.id ?? req.headers["x-request-id"] ?? traceId),
        requestSource: "post_bookings",
        logger: req.log,
      });

      const booking = createResult.booking;

      const { tryReactivateLegacyCustomer } = await import("../lib/customerReactivation");
      const reactivation = await tryReactivateLegacyCustomer(customerId, "booking", {
        type: "booking",
        id: booking.id,
      });

      if (booking.status !== "cancelled" && booking.status !== "draft") {
        const { bridgeLegacyBookingToContractAndQueue } = await import("../lib/assignments/enqueueAdapters");
        let serviceName: string | null = null;
        if (serviceId) {
          const [svc] = await db.select({ name: servicesTable.name }).from(servicesTable)
            .where(eq(servicesTable.id, serviceId)).limit(1);
          serviceName = svc?.name ?? null;
        }
        await bridgeLegacyBookingToContractAndQueue(booking, serviceName);
        await bookingCapability.markWaitingAssignment(booking.id, {
          traceId,
          logger: req.log,
          actorId: req.user?.id,
        });
      }

      const fresh = await getBookingWithScope(req, booking.id);
      return res.status(201).json({
        ...fresh,
        reactivated: reactivation.reactivated,
        bookingContext: createResult.bookingContext,
        addressSnapshotId: createResult.addressSnapshotId,
        addressIdentityId: createResult.addressIdentityId,
        coverageValidationId: createResult.coverageValidationId,
      });
    } catch (err) {
      if (err instanceof BookingCoverageError) {
        req.log.warn(
          serviceabilityBlockedLogPayload(err.coverage, { customerId, serviceId: serviceId ?? null }),
          "Booking blocked by serviceability validation",
        );
        return res.status(SERVICEABILITY_HTTP_STATUS).json(serviceabilityHttpBody(err.coverage));
      }
      if (err instanceof BookingValidationError) {
        return res.status(400).json({ error: err.message, code: err.code, details: err.details });
      }
      throw err;
    }
  } catch (err) {
    req.log.error({ err }, "Create booking error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/bookings/:id/timeline", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const booking = await getBookingWithScope(req, id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    const timeline = await bookingCapability.getTimeline(id);
    return res.json({ bookingId: id, timeline });
  } catch (err) {
    req.log.error({ err }, "Get booking timeline error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/bookings/:id/events", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const booking = await getBookingWithScope(req, id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    const events = await db.select().from(bookingEventsTable)
      .where(eq(bookingEventsTable.bookingId, id))
      .orderBy(desc(bookingEventsTable.createdAt));
    return res.json(events);
  } catch (err) {
    req.log.error({ err }, "Get booking events error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/bookings/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const booking = await getBookingWithScope(req, id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    return res.json(booking);
  } catch (err) {
    req.log.error({ err }, "Get booking error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** Schedule-field edits only — no staff, photos, amount, or execution fields. */
router.patch("/bookings/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [existing] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, existing)) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const { scheduledDate, scheduledTime, notes, status } = req.body;

    if (status !== undefined) {
      return res.status(400).json({
        error: "Use POST /bookings/:id/confirm, /reschedule, /cancel, or /transition for status changes",
      });
    }

    if (req.body.staffId !== undefined || req.body.amount !== undefined
      || req.body.proofPhotoUrls !== undefined || req.body.rating !== undefined) {
      return res.status(400).json({
        error: "staffId, amount, photos, and rating are not owned by Booking Engine",
      });
    }

    if (scheduledDate || scheduledTime) {
      const result = await bookingCapability.rescheduleBooking({
        bookingId: id,
        scheduledDate: scheduledDate ?? existing.scheduledDate,
        scheduledTime: scheduledTime !== undefined ? scheduledTime : existing.scheduledTime,
        actorId: req.user?.id,
        actorName: req.user?.name,
      }, { logger: req.log });
      if (notes !== undefined) {
        await db.update(bookingsTable).set({ notes, updatedAt: new Date() }).where(eq(bookingsTable.id, id));
      }
      await logEvent(id, "reschedule", {
        fromStatus: existing.status,
        toStatus: result.booking.status,
        actorId: req.user?.id,
      });
      const fresh = await getBookingWithScope(req, id);
      return res.json(fresh);
    }

    if (notes !== undefined) {
      await db.update(bookingsTable).set({ notes, updatedAt: new Date() }).where(eq(bookingsTable.id, id));
    }

    const fresh = await getBookingWithScope(req, id);
    return res.json(fresh);
  } catch (err) {
    if (err instanceof BookingValidationError) {
      return res.status(400).json({ error: err.message, code: err.code, details: err.details });
    }
    req.log.error({ err }, "Update booking error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bookings/:id/confirm", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await getBookingWithScope(req, id);
    if (!existing) return res.status(404).json({ error: "Booking not found" });

    const { booking } = await bookingCapability.confirmBooking(id, {
      actorId: req.user?.id,
      actorName: req.user?.name,
      logger: req.log,
    });
    await logEvent(id, "status_change", {
      fromStatus: existing.status,
      toStatus: booking.status,
      actorId: req.user?.id,
      actorName: req.user?.name,
    });
    return res.json(booking);
  } catch (err) {
    if (err instanceof BookingValidationError) {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    req.log.error({ err }, "Confirm booking error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bookings/:id/transition", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, toStatus, reason } = req.body as {
      status?: string;
      toStatus?: string;
      reason?: string;
    };
    const nextRaw = toStatus ?? status;
    if (!nextRaw) return res.status(400).json({ error: "toStatus is required" });

    const allowed: BookingStatus[] = [
      "draft", "scheduled", "confirmed", "waiting_assignment", "rescheduled", "cancelled",
    ];
    if (!allowed.includes(nextRaw as BookingStatus)) {
      return res.status(400).json({
        error: `Invalid booking status "${nextRaw}". Booking Engine supports: ${allowed.join(", ")}`,
      });
    }

    const existing = await getBookingWithScope(req, id);
    if (!existing) return res.status(404).json({ error: "Booking not found" });

    const next = nextRaw as BookingStatus;
    if (!(BOOKING_TRANSITIONS[existing.status as BookingStatus] ?? []).includes(next)) {
      return res.status(400).json({
        error: `Cannot transition from ${existing.status} to ${next}`,
      });
    }

    const { booking } = await bookingCapability.transitionBooking({
      bookingId: id,
      toStatus: next,
      reason,
      actorId: req.user?.id,
      actorName: req.user?.name,
    }, { logger: req.log });

    await logEvent(id, "status_change", {
      fromStatus: existing.status,
      toStatus: booking.status,
      body: reason,
      actorId: req.user?.id,
      actorName: req.user?.name,
    });

    return res.json(booking);
  } catch (err) {
    if (err instanceof BookingValidationError) {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    req.log.error({ err }, "Transition booking error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bookings/:id/reschedule", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { scheduledDate, scheduledTime, reason } = req.body;
    if (!scheduledDate) return res.status(400).json({ error: "scheduledDate is required" });

    const existing = await getBookingWithScope(req, id);
    if (!existing) return res.status(404).json({ error: "Booking not found" });

    const { booking } = await bookingCapability.rescheduleBooking({
      bookingId: id,
      scheduledDate,
      scheduledTime,
      reason,
      actorId: req.user?.id,
      actorName: req.user?.name,
    }, { logger: req.log });

    await logEvent(id, "reschedule", {
      fromStatus: existing.status,
      toStatus: booking.status,
      body: reason ?? `Rescheduled to ${scheduledDate} ${scheduledTime ?? ""}`,
      actorId: req.user?.id,
    });

    return res.json(booking);
  } catch (err) {
    if (err instanceof BookingValidationError) {
      return res.status(400).json({ error: err.message, code: err.code, details: err.details });
    }
    req.log.error({ err }, "Reschedule booking error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bookings/:id/cancel", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { reason } = req.body as { reason?: string };
    const existing = await getBookingWithScope(req, id);
    if (!existing) return res.status(404).json({ error: "Booking not found" });

    const { booking } = await bookingCapability.cancelBooking({
      bookingId: id,
      reason,
      actorId: req.user?.id,
      actorName: req.user?.name,
    }, { logger: req.log });

    await logEvent(id, "cancel", {
      fromStatus: existing.status,
      toStatus: "cancelled",
      body: reason,
      actorId: req.user?.id,
    });

    return res.json(booking);
  } catch (err) {
    if (err instanceof BookingValidationError) {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    req.log.error({ err }, "Cancel booking error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
