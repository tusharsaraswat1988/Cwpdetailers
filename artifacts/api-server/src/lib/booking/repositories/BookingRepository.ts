import type { Booking, InsertBooking } from "@workspace/db";
import { db, bookingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export class BookingRepository {
  async create(values: InsertBooking, tx: any = db): Promise<Booking> {
    const executor = tx ?? db;
    const [booking] = await executor.insert(bookingsTable).values(values).returning();
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
}

export const bookingRepository = new BookingRepository();
