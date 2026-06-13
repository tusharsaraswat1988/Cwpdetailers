import {
  db,
  vehiclesTable,
  customersTable,
  dcmsSubscriptionsTable,
  dcmsPlansTable,
  dcmsStaffAssignmentsTable,
  dcmsSubscriptionLocationsTable,
} from "@workspace/db";
import { eq, and, or, sql } from "drizzle-orm";

import { normalizeRegistration, extractRegistrationFromText } from "./registration";
import { mapVehicleReferencePhotos } from "../vehicles/referencePhotos";

export type VehicleSearchResult = {
  vehicle: typeof vehiclesTable.$inferSelect;
  customer: typeof customersTable.$inferSelect;
  subscription: typeof dcmsSubscriptionsTable.$inferSelect | null;
  planName: string | null;
  location: typeof dcmsSubscriptionLocationsTable.$inferSelect | null;
  assigned?: boolean;
  referencePhotos: ReturnType<typeof mapVehicleReferencePhotos>;
};

/**
 * Search vehicle by registration number.
 * Normalizes separators/case — UP 65 AB 1234 and UP-65-AB-1234 resolve identically.
 */
export async function searchVehicleByRegistration(
  registrationNumber: string,
  staffId?: number,
): Promise<VehicleSearchResult | null> {
  const normalized = normalizeRegistration(registrationNumber);

  const vehicleRows = await db
    .select({
      vehicle: vehiclesTable,
      customer: customersTable,
    })
    .from(vehiclesTable)
    .innerJoin(customersTable, eq(vehiclesTable.customerId, customersTable.id))
    .where(sql`${vehiclesTable.registrationNormalized} = ${normalized} OR upper(regexp_replace(${vehiclesTable.registrationNumber}, '[^a-zA-Z0-9]', '', 'g')) = ${normalized}`)
    .limit(1);

  if (!vehicleRows[0]) return null;

  const { vehicle, customer } = vehicleRows[0];

  const subRows = await db
    .select({
      subscription: dcmsSubscriptionsTable,
      planName: dcmsPlansTable.name,
      location: dcmsSubscriptionLocationsTable,
    })
    .from(dcmsSubscriptionsTable)
    .innerJoin(dcmsPlansTable, eq(dcmsSubscriptionsTable.planId, dcmsPlansTable.id))
    .leftJoin(dcmsSubscriptionLocationsTable, eq(dcmsSubscriptionLocationsTable.subscriptionId, dcmsSubscriptionsTable.id))
    .where(and(
      eq(dcmsSubscriptionsTable.vehicleId, vehicle.id),
      or(eq(dcmsSubscriptionsTable.status, "active"), eq(dcmsSubscriptionsTable.status, "paused")),
    ))
    .limit(1);

  const subscription = subRows[0] ?? null;

  const base: VehicleSearchResult = {
    vehicle,
    customer,
    subscription: subscription?.subscription ?? null,
    planName: subscription?.planName ?? null,
    location: subscription?.location ?? null,
    referencePhotos: mapVehicleReferencePhotos(vehicle),
  };

  if (staffId && subscription) {
    const [assignment] = await db.select().from(dcmsStaffAssignmentsTable)
      .where(and(
        eq(dcmsStaffAssignmentsTable.subscriptionId, subscription.subscription.id),
        eq(dcmsStaffAssignmentsTable.staffId, staffId),
        eq(dcmsStaffAssignmentsTable.isActive, true),
      )).limit(1);
    if (!assignment) {
      return { ...base, assigned: false };
    }
  }

  return { ...base, assigned: staffId ? true : undefined };
}

/** Accepts raw OCR text and delegates to registration search after extraction. */
export async function searchVehicleFromOcrText(ocrText: string, staffId?: number) {
  const extracted = extractRegistrationFromText(ocrText);
  if (!extracted) return null;
  return searchVehicleByRegistration(extracted, staffId);
}
