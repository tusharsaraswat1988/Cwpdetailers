import { db } from "@workspace/db";
import { addressSnapshotsTable, type AddressSnapshot } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import type { AddressSnapshotEntity } from "../types";

type SnapshotReason = "BOOKING" | "CONTRACT" | "MANUAL" | "MIGRATION" | "API";

export class AddressSnapshotRepository {
  async create(entry: {
    identityId: number;
    addressId: number;
    customerId: number;
    version: number;
    snapshot: Record<string, unknown>;
    locationContext?: Record<string, unknown> | null;
    coverageValidationId?: string | null;
    snapshotReason?: SnapshotReason;
  }): Promise<AddressSnapshotEntity> {
    const [row] = await db
      .insert(addressSnapshotsTable)
      .values({
        identityId: entry.identityId,
        addressId: entry.addressId,
        customerId: entry.customerId,
        version: entry.version,
        snapshot: entry.snapshot,
        locationContext: entry.locationContext ?? null,
        coverageValidationId: entry.coverageValidationId ?? null,
        snapshotReason: entry.snapshotReason ?? "API",
      })
      .returning();

    return {
      snapshot: row!,
      data: entry.snapshot,
    };
  }

  async findById(id: number): Promise<AddressSnapshotEntity | null> {
    const [row] = await db
      .select()
      .from(addressSnapshotsTable)
      .where(eq(addressSnapshotsTable.id, id))
      .limit(1);
    if (!row) return null;
    return { snapshot: row, data: row.snapshot as Record<string, unknown> };
  }

  async listByIdentity(identityId: number): Promise<AddressSnapshot[]> {
    return db
      .select()
      .from(addressSnapshotsTable)
      .where(eq(addressSnapshotsTable.identityId, identityId))
      .orderBy(desc(addressSnapshotsTable.createdAt));
  }
}

export const addressSnapshotRepository = new AddressSnapshotRepository();
