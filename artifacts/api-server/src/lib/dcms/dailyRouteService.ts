import {
  db,
  dcmsStaffAssignmentsTable,
  dcmsSubscriptionsTable,
  dcmsVisitsTable,
  dcmsPlansTable,
  customersTable,
  vehiclesTable,
  dcmsSubscriptionLocationsTable,
} from "@workspace/db";
import { eq, and, sql, asc, gte, lte } from "drizzle-orm";
import {
  mapVehicleReferencePhotos,
  type VehicleReferencePhotos,
} from "../vehicles/referencePhotos";
import { isDateInPauseRange, todayStrInIST, dayBoundsIST } from "./dateUtils";

export type RouteStopStatus = "pending" | "completed" | "missed" | "rejected";

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
  referencePhotos: VehicleReferencePhotos;
  referencePhotosComplete: boolean;
  location: { latitude: number; longitude: number; radiusMeters: number } | null;
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
      vehicleNumber: vehiclesTable.registrationNumber,
      vehicleMake: vehiclesTable.make,
      vehicleModel: vehiclesTable.model,
      vehicleId: vehiclesTable.id,
      vehicleColor: vehiclesTable.color,
      refPhotoFrontUrl: vehiclesTable.refPhotoFrontUrl,
      refPhotoRearUrl: vehiclesTable.refPhotoRearUrl,
      refPhotoLeftUrl: vehiclesTable.refPhotoLeftUrl,
      refPhotoRightUrl: vehiclesTable.refPhotoRightUrl,
      location: dcmsSubscriptionLocationsTable,
    })
    .from(dcmsStaffAssignmentsTable)
    .innerJoin(dcmsSubscriptionsTable, eq(dcmsStaffAssignmentsTable.subscriptionId, dcmsSubscriptionsTable.id))
    .innerJoin(dcmsPlansTable, eq(dcmsSubscriptionsTable.planId, dcmsPlansTable.id))
    .innerJoin(customersTable, eq(dcmsSubscriptionsTable.customerId, customersTable.id))
    .innerJoin(vehiclesTable, eq(dcmsSubscriptionsTable.vehicleId, vehiclesTable.id))
    .leftJoin(dcmsSubscriptionLocationsTable, eq(dcmsSubscriptionLocationsTable.subscriptionId, dcmsSubscriptionsTable.id))
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
    let todayStatus: RouteStopStatus = "pending";

    if (visit?.status === "completed") todayStatus = "completed";
    else if (visit?.status === "rejected") todayStatus = "rejected";
    else if (isPastDay) todayStatus = "missed";

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
      referencePhotos: mapVehicleReferencePhotos(row),
      referencePhotosComplete: Boolean(row.refPhotoFrontUrl && row.refPhotoRearUrl),
      location: row.location ? {
        latitude: row.location.latitude,
        longitude: row.location.longitude,
        radiusMeters: row.location.radiusMeters,
      } : null,
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
