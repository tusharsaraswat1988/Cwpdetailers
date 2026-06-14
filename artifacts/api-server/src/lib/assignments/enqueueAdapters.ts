/**
 * Sprint 7 — enqueue adapters: all product lines → pending_service_assignments.
 */

import { db, customerContractsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { CustomerContract } from "@workspace/db";
import { enqueuePendingServiceAssignment } from "../assignments/pendingAssignmentEnqueue";

const ENQUEUEABLE_STATUSES = ["active", "expiring"] as const;

type SourceSystem = CustomerContract["sourceSystem"];

export async function loadContractBySource(
  sourceSystem: SourceSystem,
  sourceId: number,
): Promise<CustomerContract | null> {
  const [row] = await db.select().from(customerContractsTable)
    .where(and(
      eq(customerContractsTable.sourceSystem, sourceSystem),
      eq(customerContractsTable.sourceId, sourceId),
    ))
    .limit(1);
  return row ?? null;
}

export async function enqueuePendingForContractSource(
  sourceSystem: SourceSystem,
  sourceId: number,
  notes?: string,
): Promise<number | null> {
  const contract = await loadContractBySource(sourceSystem, sourceId);
  if (!contract) return null;
  if (!ENQUEUEABLE_STATUSES.includes(contract.status as typeof ENQUEUEABLE_STATUSES[number])) {
    return null;
  }

  return enqueuePendingServiceAssignment({
    contractRegistryId: contract.id,
    customerId: contract.customerId,
    serviceLocationId: contract.serviceLocationId,
    assetId: contract.registryAssetId,
    serviceId: contract.serviceId,
    sourceSystem: contract.sourceSystem,
    sourceId: contract.sourceId,
    notes: notes ?? `Enqueued from ${sourceSystem} source #${sourceId}`,
    contract,
  });
}

export async function enqueuePendingFromDcmsSubscription(subscriptionId: number): Promise<number | null> {
  return enqueuePendingForContractSource("dcms", subscriptionId, "Daily Cleaning plan — awaiting assignment");
}

export async function enqueuePendingFromSubscription(subscriptionId: number): Promise<number | null> {
  return enqueuePendingForContractSource("subscription", subscriptionId, "Subscription — awaiting assignment");
}

export async function enqueuePendingFromEntitlement(entitlementId: number): Promise<number | null> {
  return enqueuePendingForContractSource("entitlement", entitlementId, "Package entitlement — awaiting assignment");
}

export async function enqueuePendingFromLegacyBooking(bookingId: number): Promise<number | null> {
  return enqueuePendingForContractSource("booking", bookingId, "Legacy booking — awaiting unified assignment");
}

export async function bridgeLegacyBookingToContractAndQueue(
  booking: {
    id: number;
    customerId: number;
    vehicleId: number | null;
    solarSiteId: number | null;
    serviceLocationId: number | null;
    assetId: number | null;
    serviceId: number | null;
    scheduledDate: string;
    status: string;
    serviceType: string;
    companyId: number | null;
    franchiseeId: number | null;
    branchId: number | null;
  },
  serviceName?: string | null,
): Promise<number | null> {
  if (booking.status === "cancelled") return null;

  const { syncContractFromBooking } = await import("../contracts/contractRegistry");
  const registryAssetId = booking.assetId ?? booking.vehicleId ?? booking.solarSiteId;
  if (!registryAssetId) return null;

  await syncContractFromBooking(booking as Parameters<typeof syncContractFromBooking>[0], {
    serviceName: serviceName ?? booking.serviceType.replace(/_/g, " "),
    catalogRefKind: booking.serviceId ? "service" : "booking",
    catalogRefId: booking.serviceId ?? booking.id,
    registryAssetId,
  });

  return enqueuePendingFromLegacyBooking(booking.id);
}
