import {
  db,
  dcmsVisitsTable,
  dcmsOperationalExceptionsTable,
  type DcmsVisit,
} from "@workspace/db";
import { eq, and, sql, lte, isNull, isNotNull, inArray, or } from "drizzle-orm";
import { logger } from "../logger";

export const DEFAULT_ROUTINE_MEDIA_RETENTION_DAYS = 30;
export const DEFAULT_EXCEPTION_MEDIA_RETENTION_DAYS = 90;

export type MediaRetentionPolicy = {
  routineRetentionDays: number;
  exceptionRetentionDays: number;
  notice: string;
};

export function getMediaRetentionPolicy(): MediaRetentionPolicy {
  return {
    routineRetentionDays: DEFAULT_ROUTINE_MEDIA_RETENTION_DAYS,
    exceptionRetentionDays: DEFAULT_EXCEPTION_MEDIA_RETENTION_DAYS,
    notice:
      "Daily car cleaning verification photos are retained for 30 days for service quality assurance. Disputed visits or open exceptions are retained for 90 days or until resolved. Upon expiration, photographic binaries are purged while preserving visit verification timestamps, GPS, plate recognition, and cleaner audit trails.",
  };
}

export type PurgeExpiredMediaOptions = {
  days?: number;
  dryRun?: boolean;
  performedBy?: number;
  limit?: number;
};

export type PurgeExpiredMediaResult = {
  dryRun: boolean;
  retentionDays: number;
  cutoffDate: Date;
  eligibleCount: number;
  purgedCount: number;
  visitIds: number[];
};

export async function purgeExpiredVisitMedia(
  options?: PurgeExpiredMediaOptions,
): Promise<PurgeExpiredMediaResult> {
  const days = options?.days ?? DEFAULT_ROUTINE_MEDIA_RETENTION_DAYS;
  const dryRun = options?.dryRun ?? false;
  const lim = Math.min(options?.limit ?? 500, 2000);
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // 1. Find visits with photoUrl older than cutoffDate where retentionHold is not set
  const eligibleVisits = await db
    .select({
      id: dcmsVisitsTable.id,
      visitTime: dcmsVisitsTable.visitTime,
      subscriptionId: dcmsVisitsTable.subscriptionId,
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

  const finalVisitIds = candidateIds.filter((id) => !blockedVisitIds.has(id));

  if (finalVisitIds.length === 0 || dryRun) {
    return {
      dryRun,
      retentionDays: days,
      cutoffDate,
      eligibleCount: finalVisitIds.length,
      purgedCount: 0,
      visitIds: finalVisitIds,
    };
  }

  const now = new Date();
  await db
    .update(dcmsVisitsTable)
    .set({
      photoUrl: null,
      mediaPurgedAt: now,
    })
    .where(inArray(dcmsVisitsTable.id, finalVisitIds));

  logger.info(
    {
      action: "media_retention_purge",
      purgedCount: finalVisitIds.length,
      retentionDays: days,
      cutoffDate,
      performedBy: options?.performedBy,
    },
    `Purged photo media for ${finalVisitIds.length} visits older than ${days} days`,
  );

  return {
    dryRun: false,
    retentionDays: days,
    cutoffDate,
    eligibleCount: finalVisitIds.length,
    purgedCount: finalVisitIds.length,
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
