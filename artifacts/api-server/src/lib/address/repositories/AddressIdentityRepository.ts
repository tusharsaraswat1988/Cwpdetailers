import { db } from "@workspace/db";
import {
  addressIdentitiesTable,
  type AddressIdentity,
  type InsertAddressIdentity,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";

export class AddressIdentityRepository {
  async create(data: InsertAddressIdentity): Promise<AddressIdentity> {
    const [row] = await db.insert(addressIdentitiesTable).values(data).returning();
    return row!;
  }

  async findById(id: number): Promise<AddressIdentity | null> {
    const [row] = await db
      .select()
      .from(addressIdentitiesTable)
      .where(eq(addressIdentitiesTable.id, id))
      .limit(1);
    return row ?? null;
  }

  async findByCustomer(customerId: number): Promise<AddressIdentity[]> {
    return db
      .select()
      .from(addressIdentitiesTable)
      .where(
        and(
          eq(addressIdentitiesTable.customerId, customerId),
          eq(addressIdentitiesTable.status, "ACTIVE"),
        ),
      );
  }

  async markMerged(id: number, mergedIntoIdentityId: number): Promise<void> {
    await db
      .update(addressIdentitiesTable)
      .set({
        status: "MERGED",
        mergedIntoIdentityId,
        updatedAt: new Date(),
      })
      .where(eq(addressIdentitiesTable.id, id));
  }

  async archive(id: number): Promise<void> {
    await db
      .update(addressIdentitiesTable)
      .set({ status: "ARCHIVED", updatedAt: new Date() })
      .where(eq(addressIdentitiesTable.id, id));
  }
}

export const addressIdentityRepository = new AddressIdentityRepository();
