import { db } from "@workspace/db";
import { addressLegacyLinksTable, type AddressLegacyLink } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export class AddressLegacyLinkRepository {
  async upsert(link: {
    addressId?: number | null;
    identityId?: number | null;
    legacyTable: string;
    legacyId: number;
  }): Promise<AddressLegacyLink> {
    const [existing] = await db
      .select()
      .from(addressLegacyLinksTable)
      .where(
        and(
          eq(addressLegacyLinksTable.legacyTable, link.legacyTable),
          eq(addressLegacyLinksTable.legacyId, link.legacyId),
        ),
      )
      .limit(1);

    if (existing) {
      const [row] = await db
        .update(addressLegacyLinksTable)
        .set({
          addressId: link.addressId ?? existing.addressId,
          identityId: link.identityId ?? existing.identityId,
        })
        .where(eq(addressLegacyLinksTable.id, existing.id))
        .returning();
      return row!;
    }

    const [row] = await db.insert(addressLegacyLinksTable).values(link).returning();
    return row!;
  }

  async findByLegacy(legacyTable: string, legacyId: number): Promise<AddressLegacyLink | null> {
    const [row] = await db
      .select()
      .from(addressLegacyLinksTable)
      .where(
        and(
          eq(addressLegacyLinksTable.legacyTable, legacyTable),
          eq(addressLegacyLinksTable.legacyId, legacyId),
        ),
      )
      .limit(1);
    return row ?? null;
  }
}

export const addressLegacyLinkRepository = new AddressLegacyLinkRepository();
