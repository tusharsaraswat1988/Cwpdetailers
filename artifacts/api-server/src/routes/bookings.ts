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
  serviceLocationsTable,
  residentialSocietiesTable,
  societyTowersTable,
  citiesTable,
  staffTable,
  type BookingStatus,
} from "@workspace/db";
import { eq, and, or, ilike, sql, desc } from "drizzle-orm";
import { tenantFilters, tenantStamp, rowInScope, loadIfInScope } from "../middlewares/tenantScope";
import { getTodayIST } from "../subscriptions/service";
import { isDailyCleanCatalogServiceName } from "../lib/dcms/dailyCleanCatalogGuard";
import { savedLocationService } from "../lib/saved-locations/SavedLocationService";
import { resolveAuthoritativeService } from "../lib/booking/services/ServiceResolutionService";
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
  cityCol: bookingsTable.cityId,
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
  cityName: citiesTable.name,
  societyId: serviceLocationsTable.societyId,
  societyName: residentialSocietiesTable.name,
  towerName: societyTowersTable.name,
  flatNumber: serviceLocationsTable.flatNumber,
  parkingLevel: serviceLocationsTable.parkingLevel,
  parkingBay: serviceLocationsTable.parkingBay,
  parkingNotes: serviceLocationsTable.parkingNotes,
  assignedStaffId: bookingsTable.assignedStaffId,
  staffName: staffTable.name,
  staffPhone: staffTable.phone,
  startedAt: bookingsTable.startedAt,
  completedAt: bookingsTable.completedAt,
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
  rescheduledFromBookingId: bookingsTable.rescheduledFromBookingId,
  rescheduledToBookingId: bookingsTable.rescheduledToBookingId,
  isMakeupBooking: bookingsTable.isMakeupBooking,
  makeupEligibilityStatus: bookingsTable.makeupEligibilityStatus,
  technicianEnRouteAt: bookingsTable.technicianEnRouteAt,
  estimatedArrivalAt: bookingsTable.estimatedArrivalAt,
  etaMinutes: bookingsTable.etaMinutes,
  lastLocationUpdateAt: bookingsTable.lastLocationUpdateAt,
  lastKnownLatitude: bookingsTable.lastKnownLatitude,
  lastKnownLongitude: bookingsTable.lastKnownLongitude,
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
    .leftJoin(citiesTable, eq(bookingsTable.cityId, citiesTable.id))
    .leftJoin(serviceLocationsTable, eq(bookingsTable.serviceLocationId, serviceLocationsTable.id))
    .leftJoin(residentialSocietiesTable, eq(serviceLocationsTable.societyId, residentialSocietiesTable.id))
    .leftJoin(societyTowersTable, eq(serviceLocationsTable.towerId, societyTowersTable.id))
    .leftJoin(staffTable, eq(bookingsTable.assignedStaffId, staffTable.id))
    .where(eq(bookingsTable.id, id));
  if (!booking || !rowInScope(req, booking)) return null;

  try {
    const { serviceExecutionsTable, serviceExecutionPhotosTable, invoicesTable } = await import("@workspace/db");
    const photos = await db.select({
      kind: serviceExecutionPhotosTable.kind,
      url: serviceExecutionPhotosTable.url,
    })
      .from(serviceExecutionPhotosTable)
      .innerJoin(serviceExecutionsTable, eq(serviceExecutionPhotosTable.executionId, serviceExecutionsTable.id))
      .where(or(
        eq(serviceExecutionsTable.legacyBookingId, id),
        sql`${serviceExecutionsTable.serviceAssignmentId} IN (
          SELECT id FROM service_assignments WHERE booking_id = ${id}
        )`,
      ));

    const beforePhoto = photos.find(p => p.kind === "before")?.url ?? null;
    const afterPhoto = photos.find(p => p.kind === "after")?.url ?? null;
    const proofUrls = photos.map(p => p.url);

    const [invoice] = await db.select({
      id: invoicesTable.id,
      invoiceNumber: invoicesTable.invoiceNumber,
      status: invoicesTable.status,
      totalAmount: invoicesTable.totalAmount,
      paidAmount: invoicesTable.paidAmount,
      balanceDue: invoicesTable.balanceDue,
    })
      .from(invoicesTable)
      .where(or(
        eq(invoicesTable.bookingId, id),
        booking.contractRegistryId ? eq(invoicesTable.contractRegistryId, booking.contractRegistryId) : sql`false`,
      ))
      .limit(1);

    return {
      ...booking,
      beforePhotoUrl: beforePhoto,
      afterPhotoUrl: afterPhoto,
      proofPhotoUrls: proofUrls,
      invoice: invoice ?? null,
    };
  } catch {
    return booking;
  }
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
      .leftJoin(citiesTable, eq(bookingsTable.cityId, citiesTable.id))
      .leftJoin(serviceLocationsTable, eq(bookingsTable.serviceLocationId, serviceLocationsTable.id))
      .leftJoin(residentialSocietiesTable, eq(serviceLocationsTable.societyId, residentialSocietiesTable.id))
      .leftJoin(societyTowersTable, eq(serviceLocationsTable.towerId, societyTowersTable.id))
      .leftJoin(staffTable, eq(bookingsTable.assignedStaffId, staffTable.id))
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
      customerId, date, status, serviceType, cityId, societyId, serviceId, branchId, search, q,
      limit = "50", offset = "0",
    } = req.query as Record<string, string>;
    const lim = Math.min(parseInt(limit, 10), 100);
    const off = parseInt(offset, 10);

    const conditions = [...tenantFilters(req, SCOPE_COLS)];
    if (customerId) conditions.push(eq(bookingsTable.customerId, parseInt(customerId, 10)));
    if (date) conditions.push(sql`${bookingsTable.scheduledDate}::text = ${date}`);
    if (status) conditions.push(eq(bookingsTable.status, status as BookingStatus));
    if (serviceType) conditions.push(eq(bookingsTable.serviceType, serviceType as never));
    if (cityId) conditions.push(eq(bookingsTable.cityId, parseInt(cityId, 10)));
    if (branchId) conditions.push(eq(bookingsTable.branchId, parseInt(branchId, 10)));
    if (serviceId) conditions.push(eq(bookingsTable.serviceId, parseInt(serviceId, 10)));
    if (societyId) conditions.push(eq(serviceLocationsTable.societyId, parseInt(societyId, 10)));

    const searchTerm = (search || q) as string | undefined;
    if (searchTerm && searchTerm.trim()) {
      const term = `%${searchTerm.trim()}%`;
      const numVal = parseInt(searchTerm.trim(), 10);
      const searchOrs = [
        ilike(customersTable.name, term),
        ilike(customersTable.phone, term),
        ilike(bookingsTable.address, term),
        ilike(residentialSocietiesTable.name, term),
      ];
      if (!isNaN(numVal)) {
        searchOrs.push(eq(bookingsTable.id, numVal));
      }
      conditions.push(or(...searchOrs)!);
    }

    const includeLegacyDaily = req.query.includeLegacyDaily === "true";
    if (!includeLegacyDaily) {
      conditions.push(sql`${bookingsTable.serviceType} <> 'daily_cleaning'`);
    }

    const where = conditions.length ? and(...conditions) : undefined;

    const [data, countResult] = await Promise.all([
      db.select(bookingSelect).from(bookingsTable)
        .leftJoin(customersTable, eq(bookingsTable.customerId, customersTable.id))
        .leftJoin(servicesTable, eq(bookingsTable.serviceId, servicesTable.id))
        .leftJoin(citiesTable, eq(bookingsTable.cityId, citiesTable.id))
        .leftJoin(serviceLocationsTable, eq(bookingsTable.serviceLocationId, serviceLocationsTable.id))
        .leftJoin(residentialSocietiesTable, eq(serviceLocationsTable.societyId, residentialSocietiesTable.id))
        .leftJoin(societyTowersTable, eq(serviceLocationsTable.towerId, societyTowersTable.id))
        .leftJoin(staffTable, eq(bookingsTable.assignedStaffId, staffTable.id))
        .where(where).orderBy(desc(bookingsTable.createdAt)).limit(lim).offset(off),
      db.select({ count: sql<number>`count(*)` }).from(bookingsTable)
        .leftJoin(customersTable, eq(bookingsTable.customerId, customersTable.id))
        .leftJoin(serviceLocationsTable, eq(bookingsTable.serviceLocationId, serviceLocationsTable.id))
        .leftJoin(residentialSocietiesTable, eq(serviceLocationsTable.societyId, residentialSocietiesTable.id))
        .where(where),
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
      contractRegistryId, addressId, postalCode, addressComponents,
      redeemLoyaltyPoints,
    } = req.body;
    let cityName = typeof req.body.cityName === "string" ? req.body.cityName : undefined;

    if (!customerId || !scheduledDate || (!serviceType && !serviceId)) {
      return res.status(400).json({
        error: "customerId, scheduledDate, and service identification (serviceId or serviceType) are required",
        code: "INVALID_SERVICE",
      });
    }

    let snapshotAddress = typeof address === "string" ? address : "";
    let snapshotArea = typeof area === "string" ? area : undefined;
    let snapshotLat = locationLat ?? null;
    let snapshotLng = locationLng ?? null;
    let snapshotPlaceId = placeId ?? null;
    let snapshotCityId = cityId ?? null;
    let snapshotPostal = typeof postalCode === "string" ? postalCode : undefined;
    let resolvedSavedLocationId = savedLocationId ?? null;

    if (serviceLocationId) {
      const [loc] = await db
        .select()
        .from(serviceLocationsTable)
        .where(eq(serviceLocationsTable.id, Number(serviceLocationId)))
        .limit(1);
      if (loc) {
        snapshotAddress = snapshotAddress.trim() || loc.address || "";
        snapshotArea = snapshotArea || loc.label || undefined;
        snapshotLat = snapshotLat ?? loc.latitude;
        snapshotLng = snapshotLng ?? loc.longitude;
        snapshotPlaceId = snapshotPlaceId || loc.placeId;
        if (loc.city) {
          cityName = cityName || loc.city;
        }
      }
    }

    if (savedLocationId) {
      const saved = await savedLocationService.getOwned(Number(savedLocationId), customerId);
      if (!saved) {
        return res.status(400).json({ error: "Saved address not found for this customer" });
      }
      const row = saved as typeof saved & {
        area?: string | null;
        cityId?: number | null;
        pincode?: string | null;
        houseNumber?: string | null;
      };
      resolvedSavedLocationId = row.id;
      snapshotAddress = snapshotAddress.trim() || row.address;
      snapshotArea = snapshotArea || row.area || undefined;
      snapshotLat = snapshotLat ?? row.latitude;
      snapshotLng = snapshotLng ?? row.longitude;
      snapshotPlaceId = snapshotPlaceId || row.placeId;
      snapshotCityId = snapshotCityId ?? row.cityId;
      snapshotPostal = snapshotPostal || row.pincode || undefined;
    }

    if (!snapshotAddress.trim()) {
      return res.status(400).json({ error: "A service address is required" });
    }
    const hasCoords = snapshotLat != null && snapshotLng != null
      && Number.isFinite(Number(snapshotLat)) && Number.isFinite(Number(snapshotLng))
      && !(Number(snapshotLat) === 0 && Number(snapshotLng) === 0);
    if (!hasCoords && !snapshotPostal && !snapshotCityId && !cityName && !citySlug) {
      return res.status(400).json({ error: "Please choose a saved address or add enough detail for us to find you." });
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

    const serviceResolution = await resolveAuthoritativeService({
      serviceId,
      serviceType,
    });
    if (!serviceResolution.success) {
      return res.status(400).json({
        error: serviceResolution.error,
        code: serviceResolution.code,
      });
    }

    const authoritativeService = serviceResolution.service;
    const resolvedServiceId = serviceResolution.serviceId;
    const resolvedServiceType = serviceResolution.serviceType;

    if (isDailyCleanCatalogServiceName(authoritativeService.name)) {
      if (
        !contractRegistryId &&
        req.body.bookingType !== "contract_visit" &&
        req.body.bookingType !== "subscription_visit" &&
        resolvedServiceType !== "daily_cleaning"
      ) {
        return res.status(400).json({
          error: "Daily cleaning is sold via monthly DCMS plans. Use Book Service → Plan, not one-time catalog service.",
          code: "DAILY_CLEANING_PLAN_REQUIRED",
        });
      }
    }

    if (!req.scope?.isSuperAdmin && req.scope?.branchIds !== null && branchId != null && !req.scope.branchIds.includes(Number(branchId))) {
      return res.status(403).json({ error: "Unauthorized branch for booking" });
    }
    const initialStatus: BookingStatus = "scheduled";
    const resolvedBranchId = (!req.scope?.isSuperAdmin && req.scope?.branchIds && req.scope.branchIds.length === 1)
      ? req.scope.branchIds[0]
      : (branchId ?? customer.branchId ?? undefined);
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
        serviceId: resolvedServiceId,
        branchId: resolvedBranchId,
        companyId: tenantValues.companyId,
        franchiseeId: tenantValues.franchiseeId,
        scheduledDate,
        scheduledTime,
        serviceType: resolvedServiceType,
        address: snapshotAddress,
        area: snapshotArea,
        locationLat: snapshotLat,
        locationLng: snapshotLng,
        placeId: snapshotPlaceId,
        savedLocationId: resolvedSavedLocationId,
        addressId,
        notes,
        cityId: snapshotCityId,
        citySlug: hasCoords ? undefined : citySlug,
        cityName: typeof cityName === "string" ? cityName : snapshotArea,
        postalCode: snapshotPostal,
        addressComponents: Array.isArray(addressComponents) ? addressComponents : undefined,
        status: initialStatus,
      }, {
        traceId,
        requestId: String(req.id ?? req.headers["x-request-id"] ?? traceId),
        requestSource: "post_bookings",
        logger: req.log,
      });

      const booking = createResult.booking;

      // Handle loyalty points debit on booking creation if requested
      if (redeemLoyaltyPoints && Number(redeemLoyaltyPoints) > 0) {
        try {
          const { debitLoyaltyPoints } = await import("../lib/loyalty/loyaltyLedgerService");
          await debitLoyaltyPoints({
            customerId: booking.customerId,
            points: Number(redeemLoyaltyPoints),
            sourceReference: "checkout_redemption",
            bookingId: booking.id,
            cityId: booking.cityId,
            branchId: booking.branchId,
            notes: `Redeemed ${redeemLoyaltyPoints} points on booking #${booking.id}`,
            idempotencyKey: `booking_redeem_${booking.id}_${redeemLoyaltyPoints}`,
          });
        } catch (debitErr) {
          req.log.warn({ err: debitErr, bookingId: booking.id }, "Failed to debit loyalty points on booking creation");
        }
      }

      const { tryReactivateLegacyCustomer } = await import("../lib/customerReactivation");
      const reactivation = await tryReactivateLegacyCustomer(customerId, "booking", {
        type: "booking",
        id: booking.id,
      });

      if (booking.status !== "cancelled") {
        const { bridgeLegacyBookingToContractAndQueue } = await import("../lib/assignments/enqueueAdapters");
        const serviceName = authoritativeService.name ?? null;
        await bridgeLegacyBookingToContractAndQueue(booking, serviceName);
        await bookingCapability.markWaitingAssignment(booking.id, {
          traceId,
          logger: req.log,
          actorId: req.user?.id,
        });

        const { notifyBookingConfirmed } = await import("../lib/notifications/dispatcher");
        notifyBookingConfirmed({
          id: booking.id,
          customerId: booking.customerId,
          customerName: customer.name,
          serviceName: authoritativeService.name,
          serviceType: booking.serviceType,
          scheduledDate: booking.scheduledDate,
          companyId: booking.companyId,
          branchId: booking.branchId,
        }).catch((err) => req.log?.error?.({ err }, "Failed to send booking confirmed notification"));
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
        if (
          err.coverage.status === "SERVICE_UNAVAILABLE" ||
          err.coverage.legacyStatus === "SERVICE_NOT_AVAILABLE" ||
          err.coverage.message === "SERVICE_UNAVAILABLE_IN_CITY" ||
          err.message === "SERVICE_UNAVAILABLE_IN_CITY"
        ) {
          const targetCity = err.coverage.city?.name ?? cityName ?? "this city";
          return res.status(400).json({
            error: `Service is not available in ${targetCity}`,
            code: "SERVICE_UNAVAILABLE_IN_CITY",
          });
        }
        req.log.warn(
          serviceabilityBlockedLogPayload(err.coverage, { customerId, serviceId: resolvedServiceId ?? null }),
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
    try {
      const { bridgeLegacyBookingToContractAndQueue } = await import("../lib/assignments/enqueueAdapters");
      await bridgeLegacyBookingToContractAndQueue(booking);
    } catch (e) {
      req.log.warn({ err: e }, "Failed to bridge confirmed booking to assignment queue");
    }
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

    // Synchronize linked active field executions with the rescheduled date/time
    const { serviceExecutionsTable } = await import("@workspace/db");
    await db.update(serviceExecutionsTable)
      .set({
        scheduledDate,
        scheduledTime: scheduledTime ?? null,
        updatedAt: new Date(),
      })
      .where(and(
        sql`(${serviceExecutionsTable.legacyBookingId} = ${id} OR ${serviceExecutionsTable.serviceAssignmentId} IN (
          SELECT id FROM service_assignments WHERE booking_id = ${id}
        ))`,
        sql`${serviceExecutionsTable.status} NOT IN ('completed', 'cancelled', 'missed')`,
      ));

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

    // Synchronize cancellation across pending assignments, assignments, and active executions
    const { pendingServiceAssignmentsTable, serviceAssignmentsTable, serviceExecutionsTable } = await import("@workspace/db");
    await db.update(pendingServiceAssignmentsTable)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(and(
        eq(pendingServiceAssignmentsTable.bookingId, id),
        sql`${pendingServiceAssignmentsTable.status} != 'cancelled'`,
      ));
    await db.update(serviceAssignmentsTable)
      .set({ status: "removed", updatedAt: new Date() })
      .where(and(
        eq(serviceAssignmentsTable.bookingId, id),
        sql`${serviceAssignmentsTable.status} != 'removed'`,
      ));
    await db.update(serviceExecutionsTable)
      .set({
        status: "cancelled",
        cancellationReason: reason ?? "Booking cancelled",
        updatedAt: new Date(),
      })
      .where(and(
        sql`(${serviceExecutionsTable.serviceAssignmentId} IN (
          SELECT id FROM service_assignments WHERE booking_id = ${id}
        ) OR ${serviceExecutionsTable.contractId} IN (
          SELECT id FROM customer_contracts WHERE source_system = 'booking' AND source_id = ${id}
        ))`,
        sql`${serviceExecutionsTable.status} NOT IN ('completed', 'cancelled', 'missed')`,
      ));

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

router.get("/bookings/:id/makeup-eligibility", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { checkMakeupEligibility } = await import("../lib/booking/services/makeupService");
    const customerId = req.user?.role === "customer" ? req.user.id : undefined;
    const result = await checkMakeupEligibility(id, customerId);
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Check makeup eligibility error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bookings/:id/reschedule-missed", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { scheduledDate, scheduledTime, notes } = req.body;
    if (!scheduledDate) {
      return res.status(400).json({ error: "scheduledDate is required", code: "MISSING_DATE" });
    }
    const { scheduleMakeupBooking } = await import("../lib/booking/services/makeupService");
    const result = await scheduleMakeupBooking(req, {
      bookingId: id,
      scheduledDate,
      scheduledTime,
      notes,
    });
    return res.status(201).json(result);
  } catch (err) {
    if (err instanceof BookingValidationError) {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    req.log.error({ err }, "Reschedule missed booking error");
    return res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.post("/bookings/:id/en-route", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { latitude, longitude, accuracy } = req.body;
    const { markTechnicianEnRoute } = await import("../lib/booking/services/trackingService");
    const result = await markTechnicianEnRoute(req, {
      bookingId: id,
      latitude: latitude != null ? Number(latitude) : undefined,
      longitude: longitude != null ? Number(longitude) : undefined,
      accuracy: accuracy != null ? Number(accuracy) : undefined,
    });
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Mark booking en route error");
    return res.status(400).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.get("/bookings/:id/tracking", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { getLiveTracking } = await import("../lib/booking/services/trackingService");
    const tracking = await getLiveTracking(req, id);
    return res.json(tracking);
  } catch (err) {
    req.log.error({ err }, "Get booking tracking error");
    return res.status(400).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

export default router;
