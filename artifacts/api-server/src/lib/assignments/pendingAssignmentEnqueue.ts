/**
 * Canonical enqueue path for the long-term operational queue.
 * All service sources MUST write here — never create parallel pending queues.
 *
 * Sprint 6 approved: pending_service_assignments remains the single source of truth
 * for work awaiting staff assignment.
 */

import {
  db,
  pendingServiceAssignmentsTable,
  type CustomerContract,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@workspace/db/schema";

type Transaction = Parameters<Parameters<NodePgDatabase<typeof schema>["transaction"]>[0]>[0];

export type TenantFields = {
  companyId?: number | null;
  franchiseeId?: number | null;
  branchId?: number | null;
};

export type EnqueuePendingAssignmentInput = {
  contractRegistryId: number;
  customerId: number;
  serviceLocationId?: number | null;
  assetId?: number | null;
  serviceId?: number | null;
  sourceSystem: CustomerContract["sourceSystem"];
  sourceId: number;
  notes?: string | null;
  tenant?: TenantFields;
  contract?: Pick<CustomerContract, "companyId" | "franchiseeId" | "branchId">;
};

/**
 * Product lines that must enqueue via adapters before Sprint 7 completion.
 * book_services_contract is live; others are Sprint 7 prerequisites.
 */
export const PENDING_ENQUEUE_ADAPTERS = {
  book_services_contract: { status: "live" as const, handler: "contractBillingService → enqueuePendingServiceAssignment" },
  dcms_subscription: { status: "live" as const, handler: "createSubscription → enqueuePendingFromDcmsSubscription" },
  solar_amc: { status: "live" as const, handler: "subscriptions + entitlements → enqueuePendingForContractSource" },
  wash_package: { status: "live" as const, handler: "subscriptions + entitlements → enqueuePendingForContractSource" },
  legacy_booking: { status: "live" as const, handler: "POST /bookings → bridgeLegacyBookingToContractAndQueue" },
} as const;

/**
 * Insert or return existing pending row for a contract (idempotent per contract while pending).
 */
export async function enqueuePendingServiceAssignment(
  input: EnqueuePendingAssignmentInput,
  tx?: Transaction,
): Promise<number> {
  const ctx = tx ?? db;

  const [existing] = await ctx.select().from(pendingServiceAssignmentsTable)
    .where(and(
      eq(pendingServiceAssignmentsTable.contractRegistryId, input.contractRegistryId),
      eq(pendingServiceAssignmentsTable.status, "pending"),
    ))
    .limit(1);
  if (existing) return existing.id;

  const tenant = input.tenant ?? {};
  const contract = input.contract;

  const [row] = await ctx.insert(pendingServiceAssignmentsTable).values({
    contractRegistryId: input.contractRegistryId,
    customerId: input.customerId,
    serviceLocationId: input.serviceLocationId ?? null,
    assetId: input.assetId ?? null,
    serviceId: input.serviceId ?? null,
    sourceSystem: input.sourceSystem,
    sourceId: input.sourceId,
    status: "pending",
    notes: input.notes ?? "Awaiting manual assignment via /admin/assign-services",
    companyId: tenant.companyId ?? contract?.companyId ?? null,
    franchiseeId: tenant.franchiseeId ?? contract?.franchiseeId ?? null,
    branchId: tenant.branchId ?? contract?.branchId ?? null,
  }).returning();

  return row!.id;
}

/** Convenience wrapper for contract-registry rows created via Book Services. */
export async function enqueuePendingFromContract(
  contract: CustomerContract,
  tenant: TenantFields,
  tx?: Transaction,
): Promise<number> {
  return enqueuePendingServiceAssignment({
    contractRegistryId: contract.id,
    customerId: contract.customerId,
    serviceLocationId: contract.serviceLocationId,
    assetId: contract.registryAssetId,
    serviceId: contract.serviceId,
    sourceSystem: contract.sourceSystem,
    sourceId: contract.sourceId,
    notes: "Created from Book Services billing — awaiting assignment",
    tenant,
    contract,
  }, tx);
}
