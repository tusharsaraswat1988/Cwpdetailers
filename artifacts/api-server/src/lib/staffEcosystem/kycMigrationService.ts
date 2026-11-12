import { db, staffDocumentsTable } from "@workspace/db";
import { eq, and, sql, inArray } from "drizzle-orm";
import { isCloudinaryConfigured, extractCloudinaryPublicId } from "../cloudinaryStorage";
import { v2 as cloudinary } from "cloudinary";
import { logger } from "../logger";

const SENSITIVE_KYC_TYPES = ["aadhaar", "pan", "bank_passbook", "bank_cancelled_cheque"];

export type KycMigrationStatus = {
  totalScanned: number;
  migratedCount: number;
  skippedCount: number;
  failedCount: number;
  isDryRun?: boolean;
  documents: Array<{
    id: number;
    staffId: number;
    documentType: string;
    status: "migrated" | "skipped_already_authenticated" | "failed" | "mock_migrated" | "dry_run_pending";
    error?: string;
  }>;
};

export type KycMigrationOptions = {
  dryRun?: boolean;
  limit?: number;
};

/**
 * Identifies legacy staff KYC documents that were uploaded to public Cloudinary buckets.
 */
export async function listLegacyPublicKycDocuments() {
  return db
    .select()
    .from(staffDocumentsTable)
    .where(
      and(
        inArray(staffDocumentsTable.documentType, SENSITIVE_KYC_TYPES),
        eq(staffDocumentsTable.isCurrent, true),
        sql`${staffDocumentsTable.fileUrl} NOT LIKE '%/authenticated/%'`,
      ),
    );
}

/**
 * Migrates a legacy public KYC document to Cloudinary authenticated storage.
 * PRD v4.2 (SEC-030): Preserves DB reference and audit history; never deletes old asset before verification.
 */
export async function migrateKycDocumentToAuthenticated(
  docId: number,
): Promise<{ success: boolean; newFileUrl?: string; error?: string }> {
  const [doc] = await db
    .select()
    .from(staffDocumentsTable)
    .where(eq(staffDocumentsTable.id, docId))
    .limit(1);

  if (!doc) return { success: false, error: "Document not found" };
  if (!doc.fileUrl) return { success: false, error: "Document has no file URL" };

  // If already authenticated, skip
  if (doc.fileUrl.includes("/authenticated/")) {
    return { success: true, newFileUrl: doc.fileUrl };
  }

  const publicId = extractCloudinaryPublicId(doc.fileUrl);
  if (!publicId) {
    return { success: false, error: "Could not extract Cloudinary public ID" };
  }

  if (!isCloudinaryConfigured()) {
    // In test / dev environments without live Cloudinary credentials
    const simulatedAuthUrl = doc.fileUrl.replace("/upload/", "/authenticated/");
    await db
      .update(staffDocumentsTable)
      .set({
        fileUrl: simulatedAuthUrl,
        updatedAt: new Date(),
      })
      .where(eq(staffDocumentsTable.id, docId));

    return { success: true, newFileUrl: simulatedAuthUrl };
  }

  try {
    // Re-upload or update type to authenticated in Cloudinary
    const result = await cloudinary.uploader.upload(doc.fileUrl, {
      public_id: publicId,
      type: "authenticated",
      overwrite: true,
      resource_type: "auto",
    });

    if (!result || !result.secure_url) {
      return { success: false, error: "Failed to upload authenticated copy to Cloudinary" };
    }

    // Update document record with authenticated secure URL
    await db
      .update(staffDocumentsTable)
      .set({
        fileUrl: result.secure_url,
        updatedAt: new Date(),
      })
      .where(eq(staffDocumentsTable.id, docId));

    logger.info({ docId, publicId }, "Successfully migrated KYC document to authenticated storage");
    return { success: true, newFileUrl: result.secure_url };
  } catch (err) {
    logger.error({ err, docId }, "Error migrating KYC document to authenticated delivery");
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Runs a batch migration of all legacy public KYC documents.
 * Supports dry-run and batch limit options for safe staging verification.
 */
export async function runKycBackfillMigration(
  opts: KycMigrationOptions = {},
): Promise<KycMigrationStatus> {
  const isDryRun = Boolean(opts.dryRun);
  let legacyDocs = await listLegacyPublicKycDocuments();
  if (opts.limit && opts.limit > 0) {
    legacyDocs = legacyDocs.slice(0, opts.limit);
  }

  const status: KycMigrationStatus = {
    totalScanned: legacyDocs.length,
    migratedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    isDryRun,
    documents: [],
  };

  for (const doc of legacyDocs) {
    if (isDryRun) {
      status.migratedCount++;
      status.documents.push({
        id: doc.id,
        staffId: doc.staffId,
        documentType: doc.documentType,
        status: "dry_run_pending",
      });
      continue;
    }

    const res = await migrateKycDocumentToAuthenticated(doc.id);
    if (res.success) {
      status.migratedCount++;
      status.documents.push({
        id: doc.id,
        staffId: doc.staffId,
        documentType: doc.documentType,
        status: isCloudinaryConfigured() ? "migrated" : "mock_migrated",
      });
    } else {
      status.failedCount++;
      status.documents.push({
        id: doc.id,
        staffId: doc.staffId,
        documentType: doc.documentType,
        status: "failed",
        error: res.error,
      });
    }
  }

  return status;
}
