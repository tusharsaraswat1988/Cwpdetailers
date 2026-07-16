import { db, bookingsTable, customersTable } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import type { BookingSearchCriteria, BookingSearchProvider, BookingSearchResult } from "./types";

export class RepositoryBookingSearchProvider implements BookingSearchProvider {
  readonly providerId = "repository";

  async search(criteria: BookingSearchCriteria) {
    const conditions = [];
    if (criteria.bookingId) conditions.push(eq(bookingsTable.id, criteria.bookingId));
    if (criteria.customerId) conditions.push(eq(bookingsTable.customerId, criteria.customerId));
    if (criteria.vehicleId) conditions.push(eq(bookingsTable.vehicleId, criteria.vehicleId));
    if (criteria.addressIdentityId) conditions.push(eq(bookingsTable.addressIdentityId, criteria.addressIdentityId));
    if (criteria.cityId) conditions.push(eq(bookingsTable.cityId, criteria.cityId));
    if (criteria.serviceId) conditions.push(eq(bookingsTable.serviceId, criteria.serviceId));
    if (criteria.serviceType) conditions.push(eq(bookingsTable.serviceType, criteria.serviceType as never));
    if (criteria.status) conditions.push(eq(bookingsTable.status, criteria.status as never));
    if (criteria.platformStatus) conditions.push(eq(bookingsTable.platformStatus, criteria.platformStatus as never));
    if (criteria.scheduledDate) conditions.push(sql`${bookingsTable.scheduledDate}::text = ${criteria.scheduledDate}`);
    if (criteria.staffId) conditions.push(eq(bookingsTable.staffId, criteria.staffId));
    if (criteria.branchId) conditions.push(eq(bookingsTable.branchId, criteria.branchId));
    if (criteria.franchiseeId) conditions.push(eq(bookingsTable.franchiseeId, criteria.franchiseeId));

    const limit = Math.min(criteria.limit ?? 50, 100);
    const offset = criteria.offset ?? 0;
    const where = conditions.length ? and(...conditions) : undefined;

    const rows = await db.select({
      id: bookingsTable.id,
      customerId: bookingsTable.customerId,
      serviceType: bookingsTable.serviceType,
      status: bookingsTable.status,
      platformStatus: bookingsTable.platformStatus,
      scheduledDate: bookingsTable.scheduledDate,
      staffId: bookingsTable.staffId,
      addressIdentityId: bookingsTable.addressIdentityId,
    }).from(bookingsTable)
      .where(where)
      .orderBy(desc(bookingsTable.createdAt))
      .limit(limit)
      .offset(offset);

    const [countRow] = await db.select({ count: sql<number>`count(*)` })
      .from(bookingsTable)
      .where(where);

    const results: BookingSearchResult[] = rows.map((r) => ({
      bookingId: r.id,
      customerId: r.customerId,
      serviceType: r.serviceType,
      status: r.status,
      platformStatus: r.platformStatus ?? undefined,
      scheduledDate: String(r.scheduledDate),
      staffId: r.staffId,
      addressIdentityId: r.addressIdentityId,
    }));

    return { results, total: Number(countRow?.count ?? 0) };
  }
}

export const repositoryBookingSearchProvider = new RepositoryBookingSearchProvider();
