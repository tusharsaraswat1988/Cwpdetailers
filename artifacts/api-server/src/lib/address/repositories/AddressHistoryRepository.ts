import { db } from "@workspace/db";
import { addressHistoryTable, type AddressHistory } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import type { AddressHistoryEntity } from "../types";

export class AddressHistoryRepository {
  async append(entry: {
    identityId: number;
    addressId: number;
    customerId: number;
    version: number;
    snapshot: Record<string, unknown>;
    changeReason?: string;
    supersededByAddressId?: number;
  }): Promise<AddressHistoryEntity> {
    const [row] = await db
      .insert(addressHistoryTable)
      .values({
        identityId: entry.identityId,
        addressId: entry.addressId,
        customerId: entry.customerId,
        version: entry.version,
        snapshot: entry.snapshot,
        changeReason: entry.changeReason,
        supersededByAddressId: entry.supersededByAddressId,
      })
      .returning();
    return row as AddressHistoryEntity;
  }

  async listByIdentity(identityId: number): Promise<AddressHistory[]> {
    return db
      .select()
      .from(addressHistoryTable)
      .where(eq(addressHistoryTable.identityId, identityId))
      .orderBy(desc(addressHistoryTable.version));
  }

  async listByCustomer(customerId: number): Promise<AddressHistory[]> {
    return db
      .select()
      .from(addressHistoryTable)
      .where(eq(addressHistoryTable.customerId, customerId))
      .orderBy(desc(addressHistoryTable.supersededAt));
  }
}

export const addressHistoryRepository = new AddressHistoryRepository();
