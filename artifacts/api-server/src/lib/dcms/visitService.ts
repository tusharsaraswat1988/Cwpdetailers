import {
  db,
  dcmsVisitsTable,
  dcmsSubscriptionsTable,
  dcmsPlansTable,
  dcmsSubscriptionLocationsTable,
  dcmsStaffAssignmentsTable,
  vehiclesTable,
  staffTable,
  customersTable,
  type DcmsVisit,
} from "@workspace/db";
import { eq, and, desc, sql, gte, lte, inArray } from "drizzle-orm";
import { logDcmsActivity } from "./auditLog";
import { isWithinRadius } from "./geoFence";
import { uploadWatermarkedVisitPhoto } from "./watermark";
import { validateCameraPhoto, sanitizeExifForStorage, ImageValidationError, type ExifPayload } from "./imageValidation";
import { emitNotificationEvent } from "./notificationEvents";
import { isSubscriptionPausedOnDate } from "./pauseService";
import { dayBoundsIST, todayStrInIST } from "./dateUtils";
import { isRenewalEligible } from "./missedVisitService";
import { logger } from "../logger";
import { traceVisitFailure, traceVisitStep } from "./visitCompleteTrace";
import {
  applyEntitlementDelta,
  planCarNotAvailable,
  planCompleteCleaning,
  type DcmsVisitStatus,
} from "./visitOutcomes";

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
  /** Walk-in entry without prior route assignment */
  walkIn?: boolean;
};

export type RecordCarNotAvailableInput = {
  subscriptionId: number;
  staffId: number;
  latitude: number;
  longitude: number;
  accuracy?: number;
  performedBy: number;
  walkIn?: boolean;
};

async function todaysCleaningVisits(subscriptionId: number, dateStr: string): Promise<DcmsVisit[]> {
  const { start, end } = dayBoundsIST(dateStr);
  return db
    .select()
    .from(dcmsVisitsTable)
    .where(and(
      eq(dcmsVisitsTable.subscriptionId, subscriptionId),
      eq(dcmsVisitsTable.visitType, "cleaning"),
      gte(dcmsVisitsTable.visitTime, start),
      lte(dcmsVisitsTable.visitTime, end),
    ))
    .orderBy(desc(dcmsVisitsTable.visitTime));
}

function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err;
  for (let i = 0; i < 5 && current; i++) {
    if (typeof current === "object" && current && "code" in current && (current as { code: string }).code === "23505") {
      return true;
    }
    current = typeof current === "object" && current && "cause" in current
      ? (current as { cause: unknown }).cause
      : null;
  }
  return false;
}

export async function completeVisit(
  input: CompleteVisitInput,
  opts?: { log?: typeof logger },
): Promise<{ visit: DcmsVisit; consumed: boolean; idempotent?: boolean }> {
  const log = opts?.log ?? logger;
  traceVisitStep(log, "request_received", {
    subscriptionId: input.subscriptionId,
    staffId: input.staffId,
    visitType: input.visitType,
    imageBytes: input.imageBase64?.length ?? 0,
    latitude: input.latitude,
    longitude: input.longitude,
    accuracy: input.accuracy,
  });

  if (!input.imageBase64) {
    traceVisitFailure(log, "input_validated", new Error("Photo required"));
  }
  traceVisitStep(log, "input_validated");

  let exifData: Record<string, unknown>;
  try {
    exifData = sanitizeExifForStorage(validateCameraPhoto(input.imageBase64, input.exif, {
      capturedAt: input.capturedAt,
    }));
    traceVisitStep(log, "image_validation_passed");
  } catch (e) {
    if (e instanceof ImageValidationError) traceVisitFailure(log, "image_validation_passed", e);
    traceVisitFailure(log, "image_validation_passed", new ImageValidationError("Invalid camera photo"));
  }

  let sub;
  try {
    [sub] = await db.select().from(dcmsSubscriptionsTable)
      .where(eq(dcmsSubscriptionsTable.id, input.subscriptionId)).limit(1);
    if (!sub) throw new Error("Subscription not found");
    if (sub.status !== "active") throw new Error("Subscription is not active");
    traceVisitStep(log, "subscription_loaded", { status: sub.status });
  } catch (e) {
    traceVisitFailure(log, "subscription_loaded", e);
  }

  const today = todayStrInIST();
  if (isSubscriptionPausedOnDate(sub, today)) {
    traceVisitFailure(log, "subscription_loaded", new Error("Subscription is paused — visits not allowed"));
  }

  const [assignment] = await db.select().from(dcmsStaffAssignmentsTable)
    .where(and(
      eq(dcmsStaffAssignmentsTable.subscriptionId, input.subscriptionId),
      eq(dcmsStaffAssignmentsTable.staffId, input.staffId),
      eq(dcmsStaffAssignmentsTable.isActive, true),
    )).limit(1);
  if (!input.walkIn && !assignment) {
    traceVisitFailure(log, "assignment_verified", new Error("Staff not assigned to this subscription"));
  }
  traceVisitStep(log, "assignment_verified", { walkIn: Boolean(input.walkIn) });

  const [vehicle] = await db.select().from(vehiclesTable)
    .where(eq(vehiclesTable.id, sub.vehicleId)).limit(1);

  const existingToday = input.visitType === "cleaning"
    ? await todaysCleaningVisits(input.subscriptionId, today)
    : [];
  const completePlan = input.visitType === "cleaning"
    ? planCompleteCleaning(existingToday)
    : null;
  if (completePlan?.action === "return") {
    const existing = existingToday.find(v => v.id === completePlan.visitId);
    if (existing) {
      traceVisitStep(log, "response_ready", { visitId: existing.id, idempotent: true });
      return { visit: existing, consumed: false, idempotent: true };
    }
  }
  if (completePlan?.action === "reject") {
    traceVisitFailure(log, "assignment_verified", new Error(completePlan.error));
  }

  const now = new Date();
  const visitDateStr = today;

  const [location] = await db.select().from(dcmsSubscriptionLocationsTable)
    .where(eq(dcmsSubscriptionLocationsTable.subscriptionId, input.subscriptionId)).limit(1);

  if (location && !isWithinRadius(
    input.latitude, input.longitude,
    location.latitude, location.longitude,
    location.radiusMeters,
  )) {
    traceVisitStep(log, "geofence_passed", { withinRadius: false });
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

    traceVisitFailure(log, "geofence_passed", new Error("Outside Service Area"));
  }
  traceVisitStep(log, "geofence_passed", { withinRadius: true });

  if (input.visitType === "cleaning" && sub.remainingCleanings <= 0) {
    traceVisitFailure(log, "quota_verified", new Error("No remaining cleanings"));
  }
  if (input.visitType === "wash" && sub.remainingWashes <= 0) {
    traceVisitFailure(log, "quota_verified", new Error("No remaining washes"));
  }
  traceVisitStep(log, "quota_verified");

  let photoUrl: string;
  try {
    traceVisitStep(log, "cloudinary_upload_started");
    photoUrl = await uploadWatermarkedVisitPhoto({
      imageBase64: input.imageBase64,
      dateTime: now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      vehicleNumber: vehicle?.registrationNumber ?? "UNKNOWN",
      latitude: input.latitude,
      longitude: input.longitude,
      staffName: input.staffName,
    });
    traceVisitStep(log, "cloudinary_upload_passed", { photoUrl });
  } catch (e) {
    traceVisitFailure(log, "cloudinary_upload_started", e);
  }

  try {
    traceVisitStep(log, "db_transaction_started");
    const recoverVisitId = completePlan?.action === "update" ? completePlan.visitId : null;
    const result = await db.transaction(async (tx) => {
      let visit: DcmsVisit | undefined;
      if (recoverVisitId != null) {
        const [updated] = await tx.update(dcmsVisitsTable)
          .set({
            photoUrl,
            visitTime: now,
            status: "completed",
            latitude: input.latitude,
            longitude: input.longitude,
            accuracy: input.accuracy ?? null,
            exifJson: exifData,
            ocrText: input.ocrText ?? null,
            ocrConfidence: input.ocrConfidence ?? null,
            confirmedRegistration: input.confirmedRegistration ?? null,
            rejectionReason: null,
          })
          .where(and(
            eq(dcmsVisitsTable.id, recoverVisitId),
            eq(dcmsVisitsTable.status, "car_not_available"),
          ))
          .returning();
        visit = updated;
        if (!visit) {
          const [current] = await tx.select().from(dcmsVisitsTable)
            .where(eq(dcmsVisitsTable.id, recoverVisitId)).limit(1);
          if (current?.status === "completed") {
            return { visit: current, consumed: false, idempotent: true as const };
          }
          throw new Error("Visit already completed today");
        }
      } else {
        const [inserted] = await tx.insert(dcmsVisitsTable).values({
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
        visit = inserted;
      }

      const updates: Partial<typeof sub> = { updatedAt: now };
      const delta = applyEntitlementDelta(sub, input.visitType, "completed");
      updates.usedCleanings = delta.usedCleanings;
      updates.remainingCleanings = delta.remainingCleanings;
      updates.usedWashes = delta.usedWashes;
      updates.remainingWashes = delta.remainingWashes;

      if (updates.remainingCleanings === 0 && updates.remainingWashes === 0) {
        updates.status = "completed";
      }

      const [consumedSub] = await tx.update(dcmsSubscriptionsTable)
        .set({ ...updates, version: sub.version + 1 })
        .where(and(
          eq(dcmsSubscriptionsTable.id, input.subscriptionId),
          eq(dcmsSubscriptionsTable.version, sub.version),
          input.visitType === "cleaning"
            ? sql`${dcmsSubscriptionsTable.remainingCleanings} > 0`
            : sql`${dcmsSubscriptionsTable.remainingWashes} > 0`,
        ))
        .returning({ id: dcmsSubscriptionsTable.id });
      if (!consumedSub) {
        throw new Error("Visit already completed today");
      }

      const updatedRemainingCleanings = updates.remainingCleanings ?? sub.remainingCleanings;
      const updatedRemainingWashes = updates.remainingWashes ?? sub.remainingWashes;

      if (recoverVisitId != null) {
        await logDcmsActivity({
          subscriptionId: input.subscriptionId,
          action: "visit_recovered_from_car_not_available",
          entityType: "visit",
          entityId: visit!.id,
          performedBy: input.performedBy,
          metadata: { visitType: input.visitType },
        });
      }

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

      return { visit: visit!, consumed: true, idempotent: false as const };
    });
    traceVisitStep(log, "db_insert_passed", { visitId: result.visit.id, recovered: recoverVisitId != null });
    traceVisitStep(log, "response_ready", { visitId: result.visit.id });
    return result;
  } catch (e) {
    if (isUniqueViolation(e) && input.visitType === "cleaning") {
      const again = await todaysCleaningVisits(input.subscriptionId, today);
      const completed = again.find(v => v.status === "completed");
      if (completed) {
        traceVisitStep(log, "response_ready", { visitId: completed.id, idempotent: true });
        return { visit: completed, consumed: false, idempotent: true };
      }
    }
    traceVisitFailure(log, "db_transaction_started", e);
  }
}

export async function recordCarNotAvailable(
  input: RecordCarNotAvailableInput,
  opts?: { log?: typeof logger },
): Promise<{ visit: DcmsVisit; consumed: false; attendance: "present"; idempotent?: boolean }> {
  const log = opts?.log ?? logger;
  traceVisitStep(log, "request_received", {
    subscriptionId: input.subscriptionId,
    staffId: input.staffId,
    outcome: "car_not_available",
    latitude: input.latitude,
    longitude: input.longitude,
    accuracy: input.accuracy,
  });

  if (input.latitude == null || input.longitude == null) {
    traceVisitFailure(log, "input_validated", new Error("Location required"));
  }
  traceVisitStep(log, "input_validated");

  let sub;
  try {
    [sub] = await db.select().from(dcmsSubscriptionsTable)
      .where(eq(dcmsSubscriptionsTable.id, input.subscriptionId)).limit(1);
    if (!sub) throw new Error("Subscription not found");
    if (sub.status !== "active") throw new Error("Subscription is not active");
    traceVisitStep(log, "subscription_loaded", { status: sub.status });
  } catch (e) {
    traceVisitFailure(log, "subscription_loaded", e);
  }

  const today = todayStrInIST();
  if (isSubscriptionPausedOnDate(sub, today)) {
    traceVisitFailure(log, "subscription_loaded", new Error("Subscription is paused — visits not allowed"));
  }

  const [assignment] = await db.select().from(dcmsStaffAssignmentsTable)
    .where(and(
      eq(dcmsStaffAssignmentsTable.subscriptionId, input.subscriptionId),
      eq(dcmsStaffAssignmentsTable.staffId, input.staffId),
      eq(dcmsStaffAssignmentsTable.isActive, true),
    )).limit(1);
  if (!input.walkIn && !assignment) {
    traceVisitFailure(log, "assignment_verified", new Error("Staff not assigned to this subscription"));
  }
  traceVisitStep(log, "assignment_verified", { walkIn: Boolean(input.walkIn) });

  const existing = await todaysCleaningVisits(input.subscriptionId, today);
  const plan = planCarNotAvailable(existing);
  if (plan.action === "reject") {
    traceVisitFailure(log, "assignment_verified", new Error(plan.error));
  }
  if (plan.action === "return") {
    const visit = existing.find(v => v.id === plan.visitId);
    if (visit) {
      traceVisitStep(log, "response_ready", { visitId: visit.id, idempotent: true });
      return { visit, consumed: false, attendance: "present", idempotent: true };
    }
  }

  const [vehicle] = await db.select().from(vehiclesTable)
    .where(eq(vehiclesTable.id, sub.vehicleId)).limit(1);

  const now = new Date();
  const [location] = await db.select().from(dcmsSubscriptionLocationsTable)
    .where(eq(dcmsSubscriptionLocationsTable.subscriptionId, input.subscriptionId)).limit(1);

  if (location && !isWithinRadius(
    input.latitude, input.longitude,
    location.latitude, location.longitude,
    location.radiusMeters,
  )) {
    traceVisitStep(log, "geofence_passed", { withinRadius: false });
    const [rejected] = await db.insert(dcmsVisitsTable).values({
      subscriptionId: input.subscriptionId,
      vehicleId: sub.vehicleId,
      staffId: input.staffId,
      visitType: "cleaning",
      status: "rejected",
      photoUrl: null,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy ?? null,
      rejectionReason: "Outside Service Area",
      visitDate: today,
    }).returning();

    await logDcmsActivity({
      subscriptionId: input.subscriptionId,
      action: "visit_rejected",
      entityType: "visit",
      entityId: rejected!.id,
      performedBy: input.performedBy,
      metadata: { reason: "Outside Service Area", outcome: "car_not_available" },
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

    traceVisitFailure(log, "geofence_passed", new Error("Outside Service Area"));
  }
  traceVisitStep(log, "geofence_passed", { withinRadius: true });

  try {
    traceVisitStep(log, "db_transaction_started");
    const result = await db.transaction(async (tx) => {
      const [visit] = await tx.insert(dcmsVisitsTable).values({
        subscriptionId: input.subscriptionId,
        vehicleId: sub.vehicleId,
        staffId: input.staffId,
        visitType: "cleaning",
        photoUrl: null,
        visitTime: now,
        visitDate: today,
        status: "car_not_available",
        latitude: input.latitude,
        longitude: input.longitude,
        accuracy: input.accuracy ?? null,
        exifJson: null,
      }).returning();

      await logDcmsActivity({
        subscriptionId: input.subscriptionId,
        action: "visit_car_not_available",
        entityType: "visit",
        entityId: visit!.id,
        performedBy: input.performedBy,
        metadata: {
          remainingCleanings: sub.remainingCleanings,
          remainingWashes: sub.remainingWashes,
        },
      });

      return { visit: visit!, consumed: false as const, attendance: "present" as const };
    });
    traceVisitStep(log, "db_insert_passed", { visitId: result.visit.id, outcome: "car_not_available" });
    traceVisitStep(log, "response_ready", { visitId: result.visit.id });
    return result;
  } catch (e) {
    if (isUniqueViolation(e)) {
      const again = await todaysCleaningVisits(input.subscriptionId, today);
      const cna = again.find(v => v.status === "car_not_available");
      if (cna) {
        traceVisitStep(log, "response_ready", { visitId: cna.id, idempotent: true });
        return { visit: cna, consumed: false, attendance: "present", idempotent: true };
      }
      const completed = again.find(v => v.status === "completed");
      if (completed) {
        traceVisitFailure(log, "db_transaction_started", new Error("Cleaning already completed today"));
      }
    }
    traceVisitFailure(log, "db_transaction_started", e);
  }
}

export async function listVisits(filters?: {
  subscriptionId?: number;
  staffId?: number;
  status?: DcmsVisitStatus;
  statuses?: DcmsVisitStatus[];
  month?: number;
  year?: number;
  vehicleId?: number;
  customerId?: number;
  from?: string;
  to?: string;
  limit?: number;
}) {
  const conditions = [];
  if (filters?.subscriptionId) conditions.push(eq(dcmsVisitsTable.subscriptionId, filters.subscriptionId));
  if (filters?.staffId) conditions.push(eq(dcmsVisitsTable.staffId, filters.staffId));
  if (filters?.statuses?.length) {
    conditions.push(inArray(dcmsVisitsTable.status, filters.statuses));
  } else if (filters?.status) {
    conditions.push(eq(dcmsVisitsTable.status, filters.status));
  }
  if (filters?.vehicleId) conditions.push(eq(dcmsVisitsTable.vehicleId, filters.vehicleId));
  if (filters?.customerId) conditions.push(eq(dcmsSubscriptionsTable.customerId, filters.customerId));
  if (filters?.from) {
    conditions.push(gte(dcmsVisitsTable.visitTime, dayBoundsIST(filters.from).start));
  }
  if (filters?.to) {
    conditions.push(lte(dcmsVisitsTable.visitTime, dayBoundsIST(filters.to).end));
  }
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
      customerId: customersTable.id,
      planName: dcmsPlansTable.name,
    })
    .from(dcmsVisitsTable)
    .innerJoin(staffTable, eq(dcmsVisitsTable.staffId, staffTable.id))
    .innerJoin(vehiclesTable, eq(dcmsVisitsTable.vehicleId, vehiclesTable.id))
    .innerJoin(dcmsSubscriptionsTable, eq(dcmsVisitsTable.subscriptionId, dcmsSubscriptionsTable.id))
    .innerJoin(customersTable, eq(dcmsSubscriptionsTable.customerId, customersTable.id))
    .innerJoin(dcmsPlansTable, eq(dcmsSubscriptionsTable.planId, dcmsPlansTable.id))
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

export type ServiceHistoryVisitCell = {
  visitId: number;
  time: string;
  staffName: string;
  photoUrl?: string | null;
  status: string;
  rejectionReason?: string | null;
};

export type ServiceHistoryRow = {
  vehicleId: number;
  vehicleNumber: string;
  customerId: number;
  customerName: string;
  subscriptionId: number;
  planName: string;
  cleaning?: ServiceHistoryVisitCell;
  wash?: ServiceHistoryVisitCell;
};

export type ServiceHistoryDay = {
  date: string;
  rows: ServiceHistoryRow[];
};

function visitDateKey(visit: DcmsVisit): string {
  if (visit.visitDate) return visit.visitDate;
  return new Date(visit.visitTime).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function toVisitCell(
  visit: DcmsVisit,
  staffName: string,
): ServiceHistoryVisitCell {
  return {
    visitId: visit.id,
    time: visit.visitTime instanceof Date ? visit.visitTime.toISOString() : String(visit.visitTime),
    staffName,
    photoUrl: visit.photoUrl,
    status: visit.status,
    rejectionReason: visit.rejectionReason,
  };
}

function assignVisitCell(
  row: ServiceHistoryRow,
  visit: DcmsVisit,
  staffName: string,
) {
  const cell = toVisitCell(visit, staffName);
  if (visit.visitType === "cleaning") {
    if (!row.cleaning || new Date(cell.time) > new Date(row.cleaning.time)) {
      row.cleaning = cell;
    }
    return;
  }
  if (visit.visitType === "wash") {
    if (!row.wash || new Date(cell.time) > new Date(row.wash.time)) {
      row.wash = cell;
    }
  }
}

/** Group cleaning + wash visits by calendar day and vehicle for admin service history. */
export async function listServiceHistory(filters?: {
  customerId?: number;
  vehicleId?: number;
  subscriptionId?: number;
  staffId?: number;
  status?: DcmsVisitStatus;
  statuses?: DcmsVisitStatus[];
  from?: string;
  to?: string;
  limit?: number;
}): Promise<ServiceHistoryDay[]> {
  const visits = await listVisits({
    ...filters,
    limit: Math.min(filters?.limit ?? 500, 1000),
  });

  const dayMap = new Map<string, Map<string, ServiceHistoryRow>>();

  for (const row of visits) {
    const dateKey = visitDateKey(row.visit);
    const rowKey = `${row.visit.vehicleId}:${row.visit.subscriptionId}`;
    if (!dayMap.has(dateKey)) dayMap.set(dateKey, new Map());
    const vehicleMap = dayMap.get(dateKey)!;

    if (!vehicleMap.has(rowKey)) {
      vehicleMap.set(rowKey, {
        vehicleId: row.visit.vehicleId,
        vehicleNumber: row.vehicleNumber,
        customerId: row.customerId,
        customerName: row.customerName,
        subscriptionId: row.visit.subscriptionId,
        planName: row.planName,
      });
    }

    assignVisitCell(vehicleMap.get(rowKey)!, row.visit, row.staffName);
  }

  return Array.from(dayMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, vehicleMap]) => ({
      date,
      rows: Array.from(vehicleMap.values()).sort((a, b) =>
        a.vehicleNumber.localeCompare(b.vehicleNumber),
      ),
    }));
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
