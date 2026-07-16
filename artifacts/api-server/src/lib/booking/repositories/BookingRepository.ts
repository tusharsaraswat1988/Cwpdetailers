import type { Booking, InsertBooking, BookingPlatformStatus } from "@workspace/db";
import { db, bookingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export class BookingRepository {
  async create(values: InsertBooking): Promise<Booking> {
    const [booking] = await db.insert(bookingsTable).values(values).returning();
    return booking;
  }

  async findById(id: number): Promise<Booking | null> {
    const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id)).limit(1);
    return booking ?? null;
  }

  async update(id: number, values: Partial<InsertBooking>): Promise<Booking | null> {
    const [booking] = await db.update(bookingsTable)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(bookingsTable.id, id))
      .returning();
    return booking ?? null;
  }

  async updatePlatformStatus(
    id: number,
    platformStatus: BookingPlatformStatus,
    legacyStatus?: string,
  ): Promise<Booking | null> {
    const update: Partial<InsertBooking> = { platformStatus };
    if (legacyStatus) update.status = legacyStatus as InsertBooking["status"];
    return this.update(id, update);
  }
}

export const bookingRepository = new BookingRepository();
