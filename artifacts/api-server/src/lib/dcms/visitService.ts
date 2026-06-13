import {
  db,
  dcmsVisitsTable,
  dcmsSubscriptionsTable,
  dcmsSubscriptionLocationsTable,
  dcmsStaffAssignmentsTable,
  vehiclesTable,
  staffTable,
  customersTable,
  type DcmsVisit,
} from "@workspace/db";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { logDcmsActivity } from "./auditLog";
import { isWithinRadius } from "./geoFence";
import { uploadWatermarkedVisitPhoto } from "./watermark";
import { validateCameraPhoto, sanitizeExifForStorage, ImageValidationError, type ExifPayload } from "./imageValidation";
import { emitNotificationEvent } from "./notificationEvents";
import { isSubscriptionPausedOnDate } from "./pauseService";
import { todayStrInIST } from "./dateUtils";
import { isRenewalEligible } from "./missedVisitService";

export type CompleteVisitInput = {
  subscriptionId: number;
  staffId: number;
  staffName: string;
  visitType: "cleaning" | "wash";
  imageBase64: string;
  exif?: ExifPayload | null;
  latitude: number;
  longitude: number;
  accuracy?: number;
  performedBy: number;
  capturedAt?: string;
  ocrText?: string | null;
  ocrConfidence?: number | null;
  confirmedRegistration?: string | null;
};

export async function completeVisit(input: CompleteVisitInput): Promise<{ visit: DcmsVisit; consumed: boolean }> {
  if (!input.imageBase64) throw new Error("Photo required");

  let exifData: Record<string, unknown>;
  try {
    exifData = sanitizeExifForStorage(validateCameraPhoto(input.imageBase64, input.exif));
  } catch (e) {
    if (e instanceof ImageValidationError) throw e;
    throw new ImageValidationError("Invalid camera photo");
  }

  const [sub] = await db.select().from(dcmsSubscriptionsTable)
    .where(eq(dcmsSubscriptionsTable.id, input.subscriptionId)).limit(1);
  if (!sub) throw new Error("Subscription not found");
  if (sub.status !== "active") throw new Error("Subscription is not active");
  const today = todayStrInIST();
  if (isSubscriptionPausedOnDate(sub, today)) {
    throw new Error("Subscription is paused — visits not allowed");
  }

  const [assignment] = await db.select().from(dcmsStaffAssignmentsTable)
    .where(and(
      eq(dcmsStaffAssignmentsTable.subscriptionId, input.subscriptionId),
      eq(dcmsStaffAssignmentsTable.staffId, input.staffId),
      eq(dcmsStaffAssignmentsTable.isActive, true),
    )).limit(1);
  if (!assignment) throw new Error("Staff not assigned to this subscription");

  const [vehicle] = await db.select().from(vehiclesTable)
    .where(eq(vehiclesTable.id, sub.vehicleId)).limit(1);

  const now = new Date();
  const visitDateStr = now.toISOString().slice(0, 10);

  const [location] = await db.select().from(dcmsSubscriptionLocationsTable)
    .where(eq(dcmsSubscriptionLocationsTable.subscriptionId, input.subscriptionId)).limit(1);

  if (location && !isWithinRadius(
    input.latitude, input.longitude,
    location.latitude, location.longitude,
    location.radiusMeters,
  )) {
    const [rejected] = await db.insert(dcmsVisitsTable).values({
      subscriptionId: input.subscriptionId,
      vehicleId: sub.vehicleId,
      staffId: input.staffId,
      visitType: input.visitType,
      status: "rejected",
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy ?? null,
      rejectionReason: "Outside Service Area",
      visitDate: visitDateStr,
      exifJson: exifData,
      ocrText: input.ocrText ?? null,
      ocrConfidence: input.ocrConfidence ?? null,
      confirmedRegistration: input.confirmedRegistration ?? null,
    }).returning();

    await logDcmsActivity({
      subscriptionId: input.subscriptionId,
      action: "visit_rejected",
      entityType: "visit",
      entityId: rejected!.id,
      performedBy: input.performedBy,
      metadata: { reason: "Outside Service Area", latitude: input.latitude, longitude: input.longitude },
    });

    await emitNotificationEvent({
      eventType: "visit_rejected",
      entityType: "visit",
      entityId: rejected!.id,
      payload: {
        visitId: rejected!.id,
        subscriptionId: input.subscriptionId,
        staffId: input.staffId,
        customerId: sub.customerId,
        vehicleNumber: vehicle?.registrationNumber ?? "UNKNOWN",
        reason: "Outside Service Area",
      },
    });

    await emitNotificationEvent({
      eventType: "fraud_alert",
      entityType: "visit",
      entityId: rejected!.id,
      payload: {
        visitId: rejected!.id,
        staffId: input.staffId,
        message: `GPS outside service area — ${vehicle?.registrationNumber ?? "vehicle"} visit rejected.`,
      },
    });

    throw new Error("Outside Service Area");
  }

  if (input.visitType === "cleaning" && sub.remainingCleanings <= 0) {
    throw new Error("No remaining cleanings");
  }
  if (input.visitType === "wash" && sub.remainingWashes <= 0) {
    throw new Error("No remaining washes");
  }

  const photoUrl = await uploadWatermarkedVisitPhoto({
    imageBase64: input.imageBase64,
    dateTime: now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    vehicleNumber: vehicle?.registrationNumber ?? "UNKNOWN",
    latitude: input.latitude,
    longitude: input.longitude,
    staffName: input.staffName,
  });

  return db.transaction(async (tx) => {
    const [visit] = await tx.insert(dcmsVisitsTable).values({
      subscriptionId: input.subscriptionId,
      vehicleId: sub.vehicleId,
      staffId: input.staffId,
      visitType: input.visitType,
      photoUrl,
      visitTime: now,
      visitDate: visitDateStr,
      status: "completed",
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy ?? null,
      exifJson: exifData,
      ocrText: input.ocrText ?? null,
      ocrConfidence: input.ocrConfidence ?? null,
      confirmedRegistration: input.confirmedRegistration ?? null,
    }).returning();

    const updates: Partial<typeof sub> = { updatedAt: now };
    if (input.visitType === "cleaning") {
      updates.usedCleanings = sub.usedCleanings + 1;
      updates.remainingCleanings = sub.remainingCleanings - 1;
    } else {
      updates.usedWashes = sub.usedWashes + 1;
      updates.remainingWashes = sub.remainingWashes - 1;
    }

    if (updates.remainingCleanings === 0 && updates.remainingWashes === 0) {
      updates.status = "completed";
    }

    await tx.update(dcmsSubscriptionsTable)
      .set({ ...updates, version: sub.version + 1 })
      .where(and(
        eq(dcmsSubscriptionsTable.id, input.subscriptionId),
        eq(dcmsSubscriptionsTable.version, sub.version),
        input.visitType === "cleaning"
          ? sql`${dcmsSubscriptionsTable.remainingCleanings} > 0`
          : sql`${dcmsSubscriptionsTable.remainingWashes} > 0`,
      ));

    const updatedRemainingCleanings = updates.remainingCleanings ?? sub.remainingCleanings;
    const updatedRemainingWashes = updates.remainingWashes ?? sub.remainingWashes;

    await logDcmsActivity({
      subscriptionId: input.subscriptionId,
      action: input.visitType === "wash" ? "wash_consumed" : "cleaning_consumed",
      entityType: "visit",
      entityId: visit!.id,
      performedBy: input.performedBy,
      metadata: { visitType: input.visitType },
    });

    await logDcmsActivity({
      subscriptionId: input.subscriptionId,
      action: "visit_uploaded",
      entityType: "visit",
      entityId: visit!.id,
      performedBy: input.performedBy,
    });

    await emitNotificationEvent({
      eventType: "visit_completed",
      entityType: "visit",
      entityId: visit!.id,
      payload: {
        visitId: visit!.id,
        subscriptionId: input.subscriptionId,
        visitType: input.visitType,
        staffId: input.staffId,
        customerId: sub.customerId,
        vehicleNumber: vehicle?.registrationNumber ?? "UNKNOWN",
        remainingWashes: updatedRemainingWashes,
      },
    });

    if (
      isRenewalEligible({
        remainingCleanings: updatedRemainingCleanings,
        remainingWashes: updatedRemainingWashes,
        status: updates.status ?? sub.status,
      })
    ) {
      await emitNotificationEvent({
        eventType: "renewal_eligible",
        entityType: "subscription",
        entityId: input.subscriptionId,
        payload: {
          subscriptionId: input.subscriptionId,
          customerId: sub.customerId,
          vehicleNumber: vehicle?.registrationNumber ?? "UNKNOWN",
        },
      });
      await emitNotificationEvent({
        eventType: "renewal_opportunity",
        entityType: "subscription",
        entityId: input.subscriptionId,
        payload: {
          subscriptionId: input.subscriptionId,
          customerId: sub.customerId,
          vehicleNumber: vehicle?.registrationNumber ?? "UNKNOWN",
        },
      });
    }

    return { visit: visit!, consumed: true };
  });
}

export async function listVisits(filters?: {
  subscriptionId?: number;
  staffId?: number;
  status?: "completed" | "rejected";
  month?: number;
  year?: number;
  vehicleId?: number;
  limit?: number;
}) {
  const conditions = [];
  if (filters?.subscriptionId) conditions.push(eq(dcmsVisitsTable.subscriptionId, filters.subscriptionId));
  if (filters?.staffId) conditions.push(eq(dcmsVisitsTable.staffId, filters.staffId));
  if (filters?.status) conditions.push(eq(dcmsVisitsTable.status, filters.status));
  if (filters?.vehicleId) conditions.push(eq(dcmsVisitsTable.vehicleId, filters.vehicleId));
  if (filters?.month && filters?.year) {
    const start = new Date(filters.year, filters.month - 1, 1);
    const end = new Date(filters.year, filters.month, 0, 23, 59, 59);
    conditions.push(gte(dcmsVisitsTable.visitTime, start));
    conditions.push(lte(dcmsVisitsTable.visitTime, end));
  }

  return db
    .select({
      visit: dcmsVisitsTable,
      staffName: staffTable.name,
      vehicleNumber: vehiclesTable.registrationNumber,
      customerName: customersTable.name,
    })
    .from(dcmsVisitsTable)
    .innerJoin(staffTable, eq(dcmsVisitsTable.staffId, staffTable.id))
    .innerJoin(vehiclesTable, eq(dcmsVisitsTable.vehicleId, vehiclesTable.id))
    .innerJoin(dcmsSubscriptionsTable, eq(dcmsVisitsTable.subscriptionId, dcmsSubscriptionsTable.id))
    .innerJoin(customersTable, eq(dcmsSubscriptionsTable.customerId, customersTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(dcmsVisitsTable.visitTime))
    .limit(filters?.limit ?? 200);
}

export async function getVisitById(id: number) {
  const result = await db
    .select({
      visit: dcmsVisitsTable,
      staffName: staffTable.name,
      vehicleNumber: vehiclesTable.registrationNumber,
    })
    .from(dcmsVisitsTable)
    .innerJoin(staffTable, eq(dcmsVisitsTable.staffId, staffTable.id))
    .innerJoin(vehiclesTable, eq(dcmsVisitsTable.vehicleId, vehiclesTable.id))
    .where(eq(dcmsVisitsTable.id, id))
    .limit(1);
  return result[0] ?? null;
}

export async function listWashHistory(filters?: {
  subscriptionId?: number;
  customerId?: number;
  vehicleId?: number;
  month?: number;
  year?: number;
  limit?: number;
}) {
  return listVisits({ ...filters, status: "completed", limit: filters?.limit ?? 200 }).then(rows =>
    rows.filter(r => r.visit.visitType === "wash"),
  );
}

/** Alias for wash-specific query at DB level. */
export async function listWashes(filters?: Parameters<typeof listVisits>[0]) {
  const conditions = [];
  if (filters?.subscriptionId) conditions.push(eq(dcmsVisitsTable.subscriptionId, filters.subscriptionId));
  if (filters?.staffId) conditions.push(eq(dcmsVisitsTable.staffId, filters.staffId));
  if (filters?.vehicleId) conditions.push(eq(dcmsVisitsTable.vehicleId, filters.vehicleId));
  conditions.push(eq(dcmsVisitsTable.visitType, "wash"));
  conditions.push(eq(dcmsVisitsTable.status, "completed"));

  if (filters?.month && filters?.year) {
    const start = new Date(filters.year, filters.month - 1, 1);
    const end = new Date(filters.year, filters.month, 0, 23, 59, 59);
    conditions.push(gte(dcmsVisitsTable.visitTime, start));
    conditions.push(lte(dcmsVisitsTable.visitTime, end));
  }

  return db
    .select({
      visit: dcmsVisitsTable,
      staffName: staffTable.name,
      vehicleNumber: vehiclesTable.registrationNumber,
      customerName: customersTable.name,
      subscriptionId: dcmsVisitsTable.subscriptionId,
    })
    .from(dcmsVisitsTable)
    .innerJoin(staffTable, eq(dcmsVisitsTable.staffId, staffTable.id))
    .innerJoin(vehiclesTable, eq(dcmsVisitsTable.vehicleId, vehiclesTable.id))
    .innerJoin(dcmsSubscriptionsTable, eq(dcmsVisitsTable.subscriptionId, dcmsSubscriptionsTable.id))
    .innerJoin(customersTable, eq(dcmsSubscriptionsTable.customerId, customersTable.id))
    .where(and(...conditions))
    .orderBy(desc(dcmsVisitsTable.visitTime))
    .limit(filters?.limit ?? 200);
}

export async function getFraudMetrics() {
  const [rejected] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(dcmsVisitsTable)
    .where(eq(dcmsVisitsTable.status, "rejected"));

  const [outsideRadius] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(dcmsVisitsTable)
    .where(and(eq(dcmsVisitsTable.status, "rejected"), eq(dcmsVisitsTable.rejectionReason, "Outside Service Area")));

  const gpsMismatch = await db
    .select({
      staffId: dcmsVisitsTable.staffId,
      staffName: staffTable.name,
      count: sql<number>`count(*)::int`,
    })
    .from(dcmsVisitsTable)
    .innerJoin(staffTable, eq(dcmsVisitsTable.staffId, staffTable.id))
    .where(eq(dcmsVisitsTable.status, "rejected"))
    .groupBy(dcmsVisitsTable.staffId, staffTable.name)
    .having(sql`count(*) >= 3`);

  return {
    rejectedUploads: rejected?.count ?? 0,
    outsideRadiusAttempts: outsideRadius?.count ?? 0,
    repeatedGpsMismatch: gpsMismatch,
    suspiciousActivity: gpsMismatch.length,
  };
}
