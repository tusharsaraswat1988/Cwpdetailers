import {
  db,
  dcmsStaffAssignmentsTable,
  dcmsSubscriptionsTable,
  dcmsVisitsTable,
  dcmsPlansTable,
  customersTable,
  vehiclesTable,
  dcmsSubscriptionLocationsTable,
  serviceLocationsTable,
} from "@workspace/db";
import { eq, and, sql, asc, gte, lte } from "drizzle-orm";
import {
  mapVehicleReferencePhotos,
  type VehicleReferencePhotos,
} from "../vehicles/referencePhotos";
import { isDateInPauseRange, todayStrInIST, dayBoundsIST } from "./dateUtils";
import { classifyRouteStop, type RouteStopStatus } from "./visitOutcomes";
import {
  resolveRouteStopDestination,
  isValidCoordinate,
  type RouteDestinationInput,
  type ResolvedDestination,
} from "./routeDestination";

export type { RouteStopStatus, RouteDestinationInput, ResolvedDestination };
export { resolveRouteStopDestination, isValidCoordinate };

export type DailyRouteStop = {
  subscriptionId: number;
  assignmentId: number;
  vehicleId: number;
  routeOrder: number;
  customerName: string;
  vehicleNumber: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string | null;
  planName: string;
  subscriptionStatus: string;
  remainingCleanings: number;
  remainingWashes: number;
  customerId: number;
  referencePhotos: VehicleReferencePhotos;
  referencePhotosComplete: boolean;
  location: { latitude: number; longitude: number; radiusMeters: number } | null;
  address: string | null;
  locationLabel: string | null;
  destinationType: "coordinates" | "address" | "missing";
  todayStatus: RouteStopStatus;
  todayVisitId?: number;
  rejectionReason?: string | null;
};

function todayStrInISTLocal(): string {
  return todayStrInIST();
}

function dayBounds(dateStr: string) {
  return dayBoundsIST(dateStr);
}

export async function getStaffDailyRoute(staffId: number, dateStr?: string): Promise<{ date: string; stops: DailyRouteStop[] }> {
  const date = dateStr ?? todayStrInISTLocal();
  const { start, end } = dayBounds(date);
  const isPastDay = date < todayStrInISTLocal();

  const assignments = await db
    .select({
      assignment: dcmsStaffAssignmentsTable,
      subscription: dcmsSubscriptionsTable,
      planName: dcmsPlansTable.name,
      customerName: customersTable.name,
      customerId: customersTable.id,
      customerAddress: customersTable.address,
      customerCity: customersTable.city,
      vehicleNumber: vehiclesTable.registrationNumber,
      vehicleMake: vehiclesTable.make,
      vehicleModel: vehiclesTable.model,
      vehicleId: vehiclesTable.id,
      vehicleColor: vehiclesTable.color,
      vehicleServiceAddress: vehiclesTable.serviceAddress,
      vehicleServiceLat: vehiclesTable.serviceLat,
      vehicleServiceLng: vehiclesTable.serviceLng,
      vehicleLocationLabel: vehiclesTable.locationLabel,
      refPhotoFrontUrl: vehiclesTable.refPhotoFrontUrl,
      refPhotoRearUrl: vehiclesTable.refPhotoRearUrl,
      refPhotoLeftUrl: vehiclesTable.refPhotoLeftUrl,
      refPhotoRightUrl: vehiclesTable.refPhotoRightUrl,
      subLocation: dcmsSubscriptionLocationsTable,
      serviceLocation: serviceLocationsTable,
    })
    .from(dcmsStaffAssignmentsTable)
    .innerJoin(dcmsSubscriptionsTable, eq(dcmsStaffAssignmentsTable.subscriptionId, dcmsSubscriptionsTable.id))
    .innerJoin(dcmsPlansTable, eq(dcmsSubscriptionsTable.planId, dcmsPlansTable.id))
    .innerJoin(customersTable, eq(dcmsSubscriptionsTable.customerId, customersTable.id))
    .innerJoin(vehiclesTable, eq(dcmsSubscriptionsTable.vehicleId, vehiclesTable.id))
    .leftJoin(dcmsSubscriptionLocationsTable, eq(dcmsSubscriptionLocationsTable.subscriptionId, dcmsSubscriptionsTable.id))
    .leftJoin(serviceLocationsTable, eq(dcmsSubscriptionsTable.serviceLocationId, serviceLocationsTable.id))
    .where(and(
      eq(dcmsStaffAssignmentsTable.staffId, staffId),
      eq(dcmsStaffAssignmentsTable.isActive, true),
      eq(dcmsSubscriptionsTable.status, "active"),
    ))
    .orderBy(asc(dcmsStaffAssignmentsTable.routeOrder), asc(dcmsStaffAssignmentsTable.id));

  const stops: DailyRouteStop[] = [];

  for (const row of assignments) {
    if (isDateInPauseRange(date, row.subscription)) continue;

    const visitsToday = await db
      .select()
      .from(dcmsVisitsTable)
      .where(and(
        eq(dcmsVisitsTable.subscriptionId, row.subscription.id),
        eq(dcmsVisitsTable.visitType, "cleaning"),
        gte(dcmsVisitsTable.visitTime, start),
        lte(dcmsVisitsTable.visitTime, end),
      ))
      .orderBy(sql`${dcmsVisitsTable.visitTime} DESC`)
      .limit(1);

    const visit = visitsToday[0];
    const todayStatus = classifyRouteStop(visit?.status, isPastDay);

    const dest = resolveRouteStopDestination({
      subLocation: row.subLocation,
      serviceLocation: row.serviceLocation,
      vehicle: {
        serviceLat: row.vehicleServiceLat,
        serviceLng: row.vehicleServiceLng,
        serviceAddress: row.vehicleServiceAddress,
        locationLabel: row.vehicleLocationLabel,
      },
      customer: {
        address: row.customerAddress,
        city: row.customerCity,
      },
    });

    stops.push({
      subscriptionId: row.subscription.id,
      assignmentId: row.assignment.id,
      vehicleId: row.vehicleId,
      routeOrder: row.assignment.routeOrder,
      customerName: row.customerName,
      vehicleNumber: row.vehicleNumber,
      vehicleMake: row.vehicleMake,
      vehicleModel: row.vehicleModel,
      vehicleColor: row.vehicleColor,
      planName: row.planName,
      subscriptionStatus: row.subscription.status,
      remainingCleanings: row.subscription.remainingCleanings,
      remainingWashes: row.subscription.remainingWashes,
      customerId: row.customerId,
      referencePhotos: mapVehicleReferencePhotos(row),
      referencePhotosComplete: Boolean(row.refPhotoFrontUrl && row.refPhotoRearUrl),
      location: dest.location,
      address: dest.address,
      locationLabel: dest.locationLabel,
      destinationType: dest.destinationType,
      todayStatus,
      todayVisitId: visit?.id,
      rejectionReason: visit?.rejectionReason,
    });
  }

  return { date, stops };
}

export async function updateRouteOrder(assignmentId: number, routeOrder: number) {
  const [assignment] = await db.select().from(dcmsStaffAssignmentsTable)
    .where(eq(dcmsStaffAssignmentsTable.id, assignmentId)).limit(1);
  if (!assignment) return;

  await db.update(dcmsStaffAssignmentsTable)
    .set({ routeOrder })
    .where(eq(dcmsStaffAssignmentsTable.id, assignmentId));

  const { emitNotificationEvent } = await import("./notificationEvents");
  await emitNotificationEvent({
    eventType: "route_updated",
    entityType: "assignment",
    entityId: assignmentId,
    payload: { staffId: assignment.staffId, subscriptionId: assignment.subscriptionId },
  });
}
