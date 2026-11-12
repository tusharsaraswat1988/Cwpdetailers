import {
  db,
  dcmsVisitsTable,
  dcmsOperationalExceptionsTable,
  type DcmsVisit,
} from "@workspace/db";
import { eq, and, sql, lte, isNull, isNotNull, inArray, or } from "drizzle-orm";
import { logger } from "../logger";
import { deleteCloudinaryAsset } from "../cloudinaryStorage";

export const DEFAULT_ROUTINE_MEDIA_RETENTION_DAYS = 30;
export const DEFAULT_EXCEPTION_MEDIA_RETENTION_DAYS = 90;

export type MediaRetentionPolicy = {
  routineRetentionDays: number;
  exceptionRetentionDays: number;
  notice: string;
  privacyNotice: string;
  privacyControls: {
    cloudinaryAssetPurge: boolean;
    plateOcrMasking: boolean;
    gpsCoarseGraining: boolean;
    disputeHoldProtection: boolean;
  };
};

export function getMediaRetentionPolicy(): MediaRetentionPolicy {
  const noticeText =
    "Daily car cleaning verification photos are retained for 30 days for service quality assurance. Disputed visits or open exceptions are retained for 90 days or until resolved. Upon expiration, photographic binaries are purged from Cloudinary while preserving visit verification timestamps, cleaner audit trails, and coarse operational metrics. Plate OCR and precise GPS coordinates are redacted to protect residential privacy.";
  return {
    routineRetentionDays: DEFAULT_ROUTINE_MEDIA_RETENTION_DAYS,
    exceptionRetentionDays: DEFAULT_EXCEPTION_MEDIA_RETENTION_DAYS,
    notice: noticeText,
    privacyNotice: noticeText,
    privacyControls: {
      cloudinaryAssetPurge: true,
      plateOcrMasking: true,
      gpsCoarseGraining: true,
      disputeHoldProtection: true,
    },
  };
}

/** Masks plate OCR text e.g. UP65AB1234 -> UP65****1234 */
export function maskPlateText(ocrText?: string | null): string | null {
  if (!ocrText) return null;
  const clean = ocrText.trim();
  if (clean.length <= 4) return "****";
  const start = clean.slice(0, 4);
  const end = clean.length > 6 ? clean.slice(-2) : "";
  return `${start}****${end}`;
}

/** Coarse-grains GPS coordinate to 2 decimal places (~1.1 km) for aggregate reporting */
export function coarseGrainCoordinate(coord?: number | null): number | null {
  if (coord == null || coord === 0) return coord ?? null;
  return Math.round(coord * 100) / 100;
}

export type PurgeExpiredMediaOptions = {
  days?: number;
  dryRun?: boolean;
  performedBy?: number;
  limit?: number;
  deleteCloudinary?: boolean;
  maskPrivacyData?: boolean;
};

export type PurgeExpiredMediaResult = {
  dryRun: boolean;
  retentionDays: number;
  cutoffDate: Date;
  eligibleCount: number;
  purgedCount: number;
  cloudinaryDeletedCount: number;
  cloudinaryFailedCount: number;
  visitIds: number[];
};

export async function purgeExpiredVisitMedia(
  options?: PurgeExpiredMediaOptions,
): Promise<PurgeExpiredMediaResult> {
  const days = options?.days ?? DEFAULT_ROUTINE_MEDIA_RETENTION_DAYS;
  const dryRun = options?.dryRun ?? false;
  const lim = Math.min(options?.limit ?? 500, 2000);
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const deleteCloudinary = options?.deleteCloudinary !== false;
  const maskPrivacy = options?.maskPrivacyData !== false;

  // 1. Find visits with photoUrl older than cutoffDate where retentionHold is not set
  const eligibleVisits = await db
    .select({
      id: dcmsVisitsTable.id,
      visitTime: dcmsVisitsTable.visitTime,
      subscriptionId: dcmsVisitsTable.subscriptionId,
      photoUrl: dcmsVisitsTable.photoUrl,
      latitude: dcmsVisitsTable.latitude,
      longitude: dcmsVisitsTable.longitude,
      ocrText: dcmsVisitsTable.ocrText,
    })
    .from(dcmsVisitsTable)
    .where(
      and(
        isNotNull(dcmsVisitsTable.photoUrl),
        isNull(dcmsVisitsTable.mediaPurgedAt),
        or(
          eq(dcmsVisitsTable.retentionHold, false),
          isNull(dcmsVisitsTable.retentionHold),
        ),
        lte(dcmsVisitsTable.visitTime, cutoffDate),
      ),
    )
    .limit(lim);

  if (eligibleVisits.length === 0) {
    return {
      dryRun,
      retentionDays: days,
      cutoffDate,
      eligibleCount: 0,
      purgedCount: 0,
      cloudinaryDeletedCount: 0,
      cloudinaryFailedCount: 0,
      visitIds: [],
    };
  }

  // 2. Filter out visits associated with open operational exceptions or disputes
  const candidateIds = eligibleVisits.map((v) => v.id);
  const openExceptions = await db
    .select({ visitId: dcmsOperationalExceptionsTable.visitId })
    .from(dcmsOperationalExceptionsTable)
    .where(
      and(
        inArray(dcmsOperationalExceptionsTable.visitId, candidateIds),
        eq(dcmsOperationalExceptionsTable.status, "open"),
      ),
    );

  const blockedVisitIds = new Set(
    openExceptions
      .map((e) => e.visitId)
      .filter((id): id is number => id != null),
  );

  const finalVisits = eligibleVisits.filter((v) => !blockedVisitIds.has(v.id));
  const finalVisitIds = finalVisits.map((v) => v.id);

  if (finalVisitIds.length === 0 || dryRun) {
    return {
      dryRun,
      retentionDays: days,
      cutoffDate,
      eligibleCount: finalVisitIds.length,
      purgedCount: 0,
      cloudinaryDeletedCount: 0,
      cloudinaryFailedCount: 0,
      visitIds: finalVisitIds,
    };
  }

  let cldDeleted = 0;
  let cldFailed = 0;

  // 3. Purge Cloudinary assets and apply privacy redactions
  const now = new Date();
  for (const v of finalVisits) {
    let deletionStatus = "skipped";
    if (deleteCloudinary && v.photoUrl) {
      try {
        const cldRes = await deleteCloudinaryAsset(v.photoUrl);
        if (cldRes.success) {
          cldDeleted++;
          deletionStatus = "deleted";
        } else {
          cldFailed++;
          deletionStatus = "failed";
        }
      } catch (err) {
        cldFailed++;
        deletionStatus = "error";
      }
    }

    const updates: Record<string, unknown> = {
      photoUrl: null,
      mediaPurgedAt: now,
      cloudinaryDeletionStatus: deletionStatus,
      mediaPurgedBy: options?.performedBy ?? null,
    };

    if (maskPrivacy) {
      if (v.ocrText) updates.ocrText = maskPlateText(v.ocrText);
      if (v.latitude) updates.latitude = coarseGrainCoordinate(v.latitude);
      if (v.longitude) updates.longitude = coarseGrainCoordinate(v.longitude);
    }

    await db
      .update(dcmsVisitsTable)
      .set(updates)
      .where(eq(dcmsVisitsTable.id, v.id));
  }

  logger.info(
    {
      action: "media_retention_purge",
      purgedCount: finalVisitIds.length,
      cloudinaryDeleted: cldDeleted,
      cloudinaryFailed: cldFailed,
      retentionDays: days,
      cutoffDate,
      performedBy: options?.performedBy,
    },
    `Purged photo media for ${finalVisitIds.length} visits older than ${days} days (${cldDeleted} Cloudinary assets removed)`,
  );

  return {
    dryRun: false,
    retentionDays: days,
    cutoffDate,
    eligibleCount: finalVisitIds.length,
    purgedCount: finalVisitIds.length,
    cloudinaryDeletedCount: cldDeleted,
    cloudinaryFailedCount: cldFailed,
    visitIds: finalVisitIds,
  };
}

export async function setVisitRetentionHold(
  visitId: number,
  hold: boolean,
  reason?: string,
  performedBy?: number,
): Promise<DcmsVisit> {
  const [existing] = await db
    .select()
    .from(dcmsVisitsTable)
    .where(eq(dcmsVisitsTable.id, visitId))
    .limit(1);

  if (!existing) {
    throw new Error("Visit not found");
  }

  const [updated] = await db
    .update(dcmsVisitsTable)
    .set({
      retentionHold: hold,
    })
    .where(eq(dcmsVisitsTable.id, visitId))
    .returning();

  logger.info(
    {
      action: "visit_retention_hold_updated",
      visitId,
      hold,
      reason,
      performedBy,
    },
    `Visit ${visitId} retention hold set to ${hold}`,
  );

  return updated!;
}
