import { db } from "@workspace/db";
import {
  serviceLocationsTable,
  customerLocationLinksTable,
  customersTable,
  type Customer,
  type InsertServiceLocation,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { isServiceLocationsEnabled } from "./featureFlag";

export const DEFAULT_LOCATION_LABEL = "Primary";

type DbLike = typeof db;

export type DefaultLocationInput = Pick<
  Customer,
  "id" | "address" | "city" | "companyId" | "franchiseeId" | "branchId" | "customerSince"
>;

function inferLocationType(address: string | null | undefined): InsertServiceLocation["locationType"] {
  if (address && address.trim()) return "residence";
  return "other";
}

/** Create Primary default location + link for a customer. Idempotent per customer. */
export async function ensureDefaultServiceLocation(
  customer: DefaultLocationInput,
  tx: DbLike = db,
): Promise<{ created: boolean; locationId: number | null }> {
  if (!isServiceLocationsEnabled()) {
    return { created: false, locationId: null };
  }

  const [existingLink] = await tx
    .select({ serviceLocationId: customerLocationLinksTable.serviceLocationId })
    .from(customerLocationLinksTable)
    .where(and(
      eq(customerLocationLinksTable.customerId, customer.id),
      eq(customerLocationLinksTable.isDefault, true),
    ))
    .limit(1);

  if (existingLink) {
    return { created: false, locationId: existingLink.serviceLocationId };
  }

  const [location] = await tx
    .insert(serviceLocationsTable)
    .values({
      label: DEFAULT_LOCATION_LABEL,
      address: customer.address ?? null,
      city: customer.city ?? null,
      locationType: inferLocationType(customer.address),
      status: "active",
      isAutoCreated: true,
      companyId: customer.companyId ?? null,
      franchiseeId: customer.franchiseeId ?? null,
      branchId: customer.branchId ?? null,
      updatedAt: new Date(),
    })
    .returning();

  await tx.insert(customerLocationLinksTable).values({
    customerId: customer.id,
    serviceLocationId: location.id,
    isDefault: true,
    effectiveFrom: customer.customerSince ?? new Date().toISOString().split("T")[0],
    updatedAt: new Date(),
  });

  return { created: true, locationId: location.id };
}

/** Backfill default locations for customers missing a default link. */
export async function backfillDefaultServiceLocations(tx: DbLike = db): Promise<number> {
  if (!isServiceLocationsEnabled()) return 0;

  const missing = await tx
    .select({
      id: customersTable.id,
      address: customersTable.address,
      city: customersTable.city,
      companyId: customersTable.companyId,
      franchiseeId: customersTable.franchiseeId,
      branchId: customersTable.branchId,
      customerSince: customersTable.customerSince,
    })
    .from(customersTable)
    .leftJoin(
      customerLocationLinksTable,
      and(
        eq(customerLocationLinksTable.customerId, customersTable.id),
        eq(customerLocationLinksTable.isDefault, true),
      ),
    )
    .where(sql`${customerLocationLinksTable.id} IS NULL`);

  let created = 0;
  for (const customer of missing) {
    const result = await ensureDefaultServiceLocation(customer, tx);
    if (result.created) created++;
  }
  return created;
}
