/**
 * Technician En-Route Status & Arrival ETA Service (TRACK-001 / Phase 17)
 * Provides non-fabricated ETA derivation, location tracking, and strict privacy controls.
 */

import { db, bookingsTable, serviceExecutionsTable, staffTable, customersTable, serviceLocationsTable, serviceExecutionLocationLogsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { Request } from "express";
import { notifyTechnicianEnRoute } from "../../notifications/dispatcher";

/** Haversine formula to compute distance in km between two GPS coordinates */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  if (lat1 === 0 || lon1 === 0 || lat2 === 0 || lon2 === 0) return 0;
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

/** Non-fabricated ETA calculation based on real distance and urban transit speed */
export function calculateEta(
  currentLat?: number | null,
  currentLng?: number | null,
  destLat?: number | null,
  destLng?: number | null,
): { distanceKm: number; etaMinutes: number; estimatedArrivalAt: Date } | null {
  if (
    currentLat == null ||
    currentLng == null ||
    destLat == null ||
    destLng == null ||
    (currentLat === 0 && currentLng === 0) ||
    (destLat === 0 && destLng === 0)
  ) {
    return null;
  }

  const distanceKm = calculateDistanceKm(currentLat, currentLng, destLat, destLng);
  // If distance is over 50km or essentially 0, precise ETA cannot be reliably estimated
  if (distanceKm <= 0.05 || distanceKm > 50) {
    return null;
  }

  // City transit speed heuristic: ~20 km/h average speed in urban traffic + 5 min parking/gate buffer
  const travelMinutes = (distanceKm / 20) * 60;
  const etaMinutes = Math.max(5, Math.round(travelMinutes + 5));
  const estimatedArrivalAt = new Date(Date.now() + etaMinutes * 60_000);

  return {
    distanceKm,
    etaMinutes,
    estimatedArrivalAt,
  };
}

export type MarkEnRouteInput = {
  bookingId?: number;
  executionId?: number;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
};

export async function markTechnicianEnRoute(
  req: Request,
  input: MarkEnRouteInput,
) {
  let bookingId = input.bookingId;
  let executionId = input.executionId;

  // Resolve booking and execution
  if (!bookingId && executionId) {
    const [exec] = await db
      .select({ legacyBookingId: serviceExecutionsTable.legacyBookingId })
      .from(serviceExecutionsTable)
      .where(eq(serviceExecutionsTable.id, executionId))
      .limit(1);
    if (exec?.legacyBookingId) bookingId = exec.legacyBookingId;
  } else if (bookingId && !executionId) {
    const [exec] = await db
      .select({ id: serviceExecutionsTable.id })
      .from(serviceExecutionsTable)
      .where(eq(serviceExecutionsTable.legacyBookingId, bookingId))
      .limit(1);
    if (exec?.id) executionId = exec.id;
  }

  if (!bookingId) {
    throw new Error("Booking or execution reference required");
  }

  const [booking] = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.id, bookingId))
    .limit(1);

  if (!booking) {
    throw new Error("Booking not found");
  }

  // Authorization check: Staff must match assigned technician, or user must be admin/manager
  if (req.user?.role === "staff") {
    const staffId = req.scope?.staffId ?? req.user.staffId;
    if (booking.assignedStaffId && staffId && booking.assignedStaffId !== staffId) {
      throw new Error("Only the assigned technician can mark en-route");
    }
  }

  // Cross-city / branch tenant isolation guard
  if (req.scope?.cityId && booking.cityId && booking.cityId !== req.scope.cityId) {
    throw new Error("Access denied: Booking belongs to another city");
  }

  // If executionId provided, verify execution staff ownership
  if (executionId && req.user?.role === "staff") {
    const staffId = req.scope?.staffId ?? req.user.staffId;
    const [exec] = await db
      .select({ assignedStaffId: serviceExecutionsTable.assignedStaffId })
      .from(serviceExecutionsTable)
      .where(eq(serviceExecutionsTable.id, executionId))
      .limit(1);
    if (exec?.assignedStaffId && staffId && exec.assignedStaffId !== staffId) {
      throw new Error("Only the assigned technician can update location for this execution");
    }
  }

  // Destination coordinates resolution
  let destLat = booking.locationLat;
  let destLng = booking.locationLng;
  if ((destLat == null || destLng == null) && booking.serviceLocationId) {
    const [loc] = await db
      .select({ latitude: serviceLocationsTable.latitude, longitude: serviceLocationsTable.longitude })
      .from(serviceLocationsTable)
      .where(eq(serviceLocationsTable.id, booking.serviceLocationId))
      .limit(1);
    if (loc?.latitude != null && loc?.longitude != null) {
      destLat = loc.latitude;
      destLng = loc.longitude;
    }
  }

  const eta = calculateEta(input.latitude, input.longitude, destLat, destLng);
  const now = new Date();

  // Duplicate ping suppression: Skip log insert if < 5s and < 5m movement
  let isDuplicatePing = false;
  if (
    input.latitude != null &&
    input.longitude != null &&
    booking.lastKnownLatitude != null &&
    booking.lastKnownLongitude != null &&
    booking.lastLocationUpdateAt != null
  ) {
    const elapsedMs = now.getTime() - new Date(booking.lastLocationUpdateAt).getTime();
    const movementMeters = calculateDistanceKm(
      input.latitude,
      input.longitude,
      booking.lastKnownLatitude,
      booking.lastKnownLongitude,
    ) * 1000;
    if (elapsedMs < 5000 && movementMeters < 5) {
      isDuplicatePing = true;
    }
  }

  // Update booking
  await db
    .update(bookingsTable)
    .set({
      technicianEnRouteAt: booking.technicianEnRouteAt ?? now,
      estimatedArrivalAt: eta?.estimatedArrivalAt ?? booking.estimatedArrivalAt ?? null,
      etaMinutes: eta?.etaMinutes ?? booking.etaMinutes ?? null,
      lastLocationUpdateAt: input.latitude != null ? now : booking.lastLocationUpdateAt,
      lastKnownLatitude: input.latitude ?? booking.lastKnownLatitude,
      lastKnownLongitude: input.longitude ?? booking.lastKnownLongitude,
      updatedAt: now,
    })
    .where(eq(bookingsTable.id, bookingId));

  // Update execution if exists
  if (executionId) {
    await db
      .update(serviceExecutionsTable)
      .set({
        enRouteAt: now,
        estimatedArrivalAt: eta?.estimatedArrivalAt ?? null,
        etaMinutes: eta?.etaMinutes ?? null,
        lastLocationUpdateAt: input.latitude != null ? now : null,
        updatedAt: now,
      })
      .where(eq(serviceExecutionsTable.id, executionId));

    if (input.latitude != null && input.longitude != null && !isDuplicatePing) {
      await db.insert(serviceExecutionLocationLogsTable).values({
        executionId,
        eventType: "gps_ping",
        latitude: input.latitude,
        longitude: input.longitude,
        accuracy: input.accuracy ?? null,
      });
    }
  }

  // Resolve staff name for notification
  let staffName = "Technician";
  if (booking.assignedStaffId) {
    const [staff] = await db
      .select({ name: staffTable.name })
      .from(staffTable)
      .where(eq(staffTable.id, booking.assignedStaffId))
      .limit(1);
    if (staff?.name) staffName = staff.name;
  }

  // Resolve customer name
  let customerName = "Customer";
  const [cust] = await db
    .select({ name: customersTable.name })
    .from(customersTable)
    .where(eq(customersTable.id, booking.customerId))
    .limit(1);
  if (cust?.name) customerName = cust.name;

  // Dispatch customer notification only on initial en-route (not every telemetry ping)
  if (!booking.technicianEnRouteAt) {
    await notifyTechnicianEnRoute({
      bookingId,
      customerId: booking.customerId,
      customerName,
      staffName,
      serviceName: booking.serviceType?.replace(/_/g, " ") ?? "Service",
      etaMinutes: eta?.etaMinutes ?? undefined,
      cityId: booking.cityId,
      branchId: booking.branchId,
    }).catch((err) => req.log?.error({ err }, "Failed to send technician en-route notification"));
  }

  return {
    success: true,
    bookingId,
    enRouteAt: (booking.technicianEnRouteAt ?? now).toISOString(),
    etaMinutes: eta?.etaMinutes ?? booking.etaMinutes ?? null,
    estimatedArrivalAt: eta?.estimatedArrivalAt?.toISOString() ?? booking.estimatedArrivalAt?.toISOString() ?? null,
    distanceKm: eta?.distanceKm ?? null,
    suppressedDuplicatePing: isDuplicatePing,
  };
}

export async function getLiveTracking(
  req: Request,
  bookingId: number,
) {
  const [booking] = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.id, bookingId))
    .limit(1);

  if (!booking) {
    throw new Error("Booking not found");
  }

  // Customer authorization check (IDOR guard)
  if (req.user?.role === "customer" && booking.customerId !== req.user.id) {
    throw new Error("Access denied: You can only view tracking for your own bookings");
  }

  // Staff authorization check
  if (req.user?.role === "staff") {
    const staffId = req.scope?.staffId ?? req.user.staffId;
    if (booking.assignedStaffId && staffId && booking.assignedStaffId !== staffId) {
      throw new Error("Access denied: You are not the assigned technician for this service");
    }
  }

  // Multi-city tenant scope isolation check
  if (req.scope?.cityId && booking.cityId && booking.cityId !== req.scope.cityId) {
    throw new Error("Access denied: Booking belongs to another city");
  }

  // Lookup technician info
  let technicianName: string | null = null;
  let technicianPhone: string | null = null;
  if (booking.assignedStaffId) {
    const [staff] = await db
      .select({ name: staffTable.name, phone: staffTable.phone })
      .from(staffTable)
      .where(eq(staffTable.id, booking.assignedStaffId))
      .limit(1);
    if (staff) {
      technicianName = staff.name;
      technicianPhone = staff.phone;
    }
  }

  // Privacy Rule: If booking is in_progress, completed, cancelled, or missed, tracking is permanently closed
  if (
    booking.status === "in_progress" ||
    booking.status === "completed" ||
    booking.status === "cancelled" ||
    booking.status === "missed"
  ) {
    return {
      trackingActive: false,
      isEnRoute: false,
      status: booking.status,
      technicianName,
      technicianPhone,
      message: booking.status === "in_progress"
        ? "Technician has arrived on-site and service is in progress."
        : `Tracking is closed for ${booking.status} services.`,
    };
  }

  const isEnRoute = Boolean(booking.technicianEnRouteAt);

  // Destination resolution
  let destLatitude = booking.locationLat;
  let destLongitude = booking.locationLng;
  let destAddress = booking.address;
  if ((destLatitude == null || destLongitude == null) && booking.serviceLocationId) {
    const [loc] = await db
      .select({
        latitude: serviceLocationsTable.latitude,
        longitude: serviceLocationsTable.longitude,
        address: serviceLocationsTable.address,
      })
      .from(serviceLocationsTable)
      .where(eq(serviceLocationsTable.id, booking.serviceLocationId))
      .limit(1);
    if (loc) {
      if (destLatitude == null && loc.latitude != null) destLatitude = loc.latitude;
      if (destLongitude == null && loc.longitude != null) destLongitude = loc.longitude;
      if (!destAddress && loc.address) destAddress = loc.address;
    }
  }

  // Technician coordinates
  const technicianLatitude = booking.lastKnownLatitude ?? null;
  const technicianLongitude = booking.lastKnownLongitude ?? null;

  // Stale location detection (> 3 minutes without ping)
  const lastUpdateMs = booking.lastLocationUpdateAt ? new Date(booking.lastLocationUpdateAt).getTime() : 0;
  const isStale = isEnRoute && (lastUpdateMs === 0 || (Date.now() - lastUpdateMs > 3 * 60 * 1000));

  // Honest route polyline: connected line between technician and destination if both coordinates are valid
  const hasValidTechCoords = technicianLatitude != null && technicianLongitude != null && technicianLatitude !== 0 && technicianLongitude !== 0;
  const hasValidDestCoords = destLatitude != null && destLongitude != null && destLatitude !== 0 && destLongitude !== 0;
  const routePolyline = (hasValidTechCoords && hasValidDestCoords)
    ? [
        [technicianLatitude, technicianLongitude] as [number, number],
        [destLatitude, destLongitude] as [number, number],
      ]
    : null;

  return {
    trackingActive: isEnRoute,
    isEnRoute,
    status: booking.status,
    technicianName,
    technicianPhone,
    enRouteAt: booking.technicianEnRouteAt?.toISOString() ?? null,
    etaMinutes: booking.etaMinutes ?? null,
    estimatedArrivalAt: booking.estimatedArrivalAt?.toISOString() ?? null,
    lastLocationUpdateAt: booking.lastLocationUpdateAt?.toISOString() ?? null,
    technicianLatitude: hasValidTechCoords ? technicianLatitude : null,
    technicianLongitude: hasValidTechCoords ? technicianLongitude : null,
    destLatitude: hasValidDestCoords ? destLatitude : null,
    destLongitude: hasValidDestCoords ? destLongitude : null,
    destAddress: destAddress ?? null,
    routePolyline,
    isStale,
    fallbackMessage: isEnRoute && (!booking.etaMinutes || isStale)
      ? "Technician is on the way. Tracking details will update upon arrival."
      : null,
  };
}
