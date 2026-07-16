import { db } from "@workspace/db";
import {
  addressesTable,
  addressIdentitiesTable,
  type Address,
  type InsertAddress,
} from "@workspace/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { AddressEntity } from "../types";
import { addressIdentityRepository } from "./AddressIdentityRepository";

export class AddressRepository {
  async create(data: InsertAddress): Promise<Address> {
    const [row] = await db.insert(addressesTable).values(data).returning();
    return row!;
  }

  async findById(id: number): Promise<Address | null> {
    const [row] = await db
      .select()
      .from(addressesTable)
      .where(eq(addressesTable.id, id))
      .limit(1);
    return row ?? null;
  }

  async findEntityById(id: number): Promise<AddressEntity | null> {
    const address = await this.findById(id);
    if (!address) return null;
    const identity = await addressIdentityRepository.findById(address.identityId);
    if (!identity) return null;
    return { identity, address };
  }

  async findCurrentByIdentity(identityId: number): Promise<Address | null> {
    const [row] = await db
      .select()
      .from(addressesTable)
      .where(
        and(
          eq(addressesTable.identityId, identityId),
          eq(addressesTable.isCurrent, true),
          isNull(addressesTable.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async listByCustomer(
    customerId: number,
    opts: { includeDeleted?: boolean; includeArchived?: boolean } = {},
  ): Promise<Address[]> {
    const conditions = [
      eq(addressesTable.customerId, customerId),
      eq(addressesTable.isCurrent, true),
    ];
    if (!opts.includeDeleted) conditions.push(isNull(addressesTable.deletedAt));
    if (!opts.includeArchived) conditions.push(isNull(addressesTable.archivedAt));

    return db
      .select()
      .from(addressesTable)
      .where(and(...conditions))
      .orderBy(sql`${addressesTable.isDefault} DESC`, sql`${addressesTable.updatedAt} DESC`);
  }

  async listDedupIndex(customerId: number) {
    return db
      .select({
        identityId: addressesTable.identityId,
        addressId: addressesTable.id,
        placeId: addressesTable.placeId,
        latitude: addressesTable.latitude,
        longitude: addressesTable.longitude,
        normalizedAddress: addressesTable.normalizedAddress,
        fingerprint: addressIdentitiesTable.fingerprint,
      })
      .from(addressesTable)
      .innerJoin(
        addressIdentitiesTable,
        eq(addressesTable.identityId, addressIdentitiesTable.id),
      )
      .where(
        and(
          eq(addressesTable.customerId, customerId),
          eq(addressesTable.isCurrent, true),
          isNull(addressesTable.deletedAt),
          eq(addressIdentitiesTable.status, "ACTIVE"),
        ),
      );
  }

  async clearDefaultForCustomer(customerId: number): Promise<void> {
    await db
      .update(addressesTable)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(and(eq(addressesTable.customerId, customerId), eq(addressesTable.isCurrent, true)));
  }

  async markNotCurrent(id: number): Promise<void> {
    await db
      .update(addressesTable)
      .set({ isCurrent: false, updatedAt: new Date() })
      .where(eq(addressesTable.id, id));
  }

  async update(id: number, patch: Partial<InsertAddress>): Promise<Address> {
    const [row] = await db
      .update(addressesTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(addressesTable.id, id))
      .returning();
    return row!;
  }

  async softDelete(id: number): Promise<Address> {
    const now = new Date();
    const [row] = await db
      .update(addressesTable)
      .set({ deletedAt: now, isDefault: false, updatedAt: now })
      .where(eq(addressesTable.id, id))
      .returning();
    return row!;
  }

  async restore(id: number): Promise<Address> {
    const [row] = await db
      .update(addressesTable)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(eq(addressesTable.id, id))
      .returning();
    return row!;
  }

  async archive(id: number): Promise<Address> {
    const now = new Date();
    const [row] = await db
      .update(addressesTable)
      .set({ archivedAt: now, isDefault: false, updatedAt: now })
      .where(eq(addressesTable.id, id))
      .returning();
    return row!;
  }
}

export const addressRepository = new AddressRepository();
