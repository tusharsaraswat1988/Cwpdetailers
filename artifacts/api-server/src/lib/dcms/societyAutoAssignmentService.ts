/**
 * JOB-001: Society Cluster Auto-Assignment Engine
 * Automatically assigns morning daily car cleaning routes based on residential society clusters,
 * tower groupings, and parking levels, enforcing workload balancing caps.
 */

import {
  db,
  dcmsSubscriptionsTable,
  dcmsStaffAssignmentsTable,
  residentialSocietiesTable,
  societyTowersTable,
  serviceLocationsTable,
  vehiclesTable,
  customersTable,
  staffTable,
} from "@workspace/db";
import { eq, and, sql, inArray } from "drizzle-orm";
import { resolveConfigKey } from "../config/configInheritanceResolver";
import { OPERATIONAL_ROLE_SLUGS, staffHasOperationalRole } from "../staffEcosystem/operationalRoles";
import { logAdminAudit } from "../audit/adminAuditService";
import { logger } from "../logger";

export type SocietyAutoAssignInput = {
  branchId: number;
  societyId?: number;
  zoneId?: number;
  maxCarsPerCleaner?: number;
  forceRebalance?: boolean;
  dryRun?: boolean;
  assignedBy: number;
};

export type AllocatedRouteStop = {
  subscriptionId: number;
  vehicleId: number;
  vehicleNumber: string;
  vehicleMake: string;
  vehicleModel: string;
  societyId: number;
  societyName: string;
  towerId: number | null;
  towerName: string | null;
  parkingLevel: string | null;
  parkingBay: string | null;
  routeOrder: number;
};

export type CleanerAssignmentBatch = {
  staffId: number;
  staffName: string;
  staffPhone: string | null;
  totalAssigned: number;
  societies: string[];
  towers: string[];
  stops: AllocatedRouteStop[];
};

export type UnassignedStop = {
  subscriptionId: number;
  vehicleNumber: string;
  societyName: string;
  reason: string;
};

export type SocietyAutoAssignResult = {
  branchId: number;
  societyId?: number;
  totalEligibleSubscriptions: number;
  assignedCount: number;
  unassignedCount: number;
  cleanersAvailable: number;
  cleanersUtilized: number;
  maxCarsCap: number;
  dryRun: boolean;
  allocations: CleanerAssignmentBatch[];
  unassignedSubscriptions: UnassignedStop[];
};

export async function autoAssignSocietyClusters(
  input: SocietyAutoAssignInput,
): Promise<SocietyAutoAssignResult> {
  const {
    branchId,
    societyId,
    zoneId,
    maxCarsPerCleaner: inputCap,
    forceRebalance = false,
    dryRun = false,
    assignedBy,
  } = input;

  // 1. Resolve capacity cap via CITY-006 config resolver if not explicitly passed
  let maxCarsCap = inputCap;
  if (!maxCarsCap || maxCarsCap <= 0) {
    const resolvedCap = await resolveConfigKey<number>("maxCarsPerCleaner", { branchId });
    maxCarsCap = Number(resolvedCap.value) || 25;
  }

  // 2. Query active daily cleaning subscriptions for this branch
  const subConditions = [
    eq(dcmsSubscriptionsTable.status, "active"),
  ];

  if (societyId) {
    subConditions.push(
      sql`(${dcmsSubscriptionsTable.societyId} = ${societyId} OR ${serviceLocationsTable.societyId} = ${societyId})`,
    );
  }

  if (zoneId) {
    subConditions.push(eq(dcmsSubscriptionsTable.zoneId, zoneId));
  }

  const rawSubs = await db
    .select({
      sub: dcmsSubscriptionsTable,
      vehicle: vehiclesTable,
      customer: customersTable,
      serviceLoc: serviceLocationsTable,
      society: residentialSocietiesTable,
      tower: societyTowersTable,
    })
    .from(dcmsSubscriptionsTable)
    .innerJoin(vehiclesTable, eq(dcmsSubscriptionsTable.vehicleId, vehiclesTable.id))
    .innerJoin(customersTable, eq(dcmsSubscriptionsTable.customerId, customersTable.id))
    .leftJoin(serviceLocationsTable, eq(dcmsSubscriptionsTable.serviceLocationId, serviceLocationsTable.id))
    .leftJoin(
      residentialSocietiesTable,
      sql`${residentialSocietiesTable.id} = COALESCE(${dcmsSubscriptionsTable.societyId}, ${serviceLocationsTable.societyId})`,
    )
    .leftJoin(
      societyTowersTable,
      sql`${societyTowersTable.id} = COALESCE(${dcmsSubscriptionsTable.towerId}, ${serviceLocationsTable.towerId})`,
    )
    .where(and(...subConditions));

  // Branch isolation check: subscription must match branch directly, or customer city/branch
  const branchSubs = rawSubs.filter((row) => {
    if (row.sub.branchId) return row.sub.branchId === branchId;
    if (row.society?.branchId) return row.society.branchId === branchId;
    return true; // if unassigned to specific branch, allow in target branch pool
  });

  // Check active assignments
  const activeAssignments = await db
    .select()
    .from(dcmsStaffAssignmentsTable)
    .where(eq(dcmsStaffAssignmentsTable.isActive, true));

  const assignedSubIds = new Set(activeAssignments.map((a) => a.subscriptionId));

  // Filter subs: if !forceRebalance, only include unassigned subscriptions
  const eligibleSubs = forceRebalance
    ? branchSubs
    : branchSubs.filter((row) => !assignedSubIds.has(row.sub.id));

  // 3. Query eligible daily car cleaners for this branch
  const candidateStaff = await db
    .select()
    .from(staffTable)
    .where(
      and(
        eq(staffTable.branchId, branchId),
        eq(staffTable.isActive, true),
        eq(staffTable.availability, "available"),
      ),
    );

  // Validate cleaner operational roles
  const eligibleCleaners: (typeof staffTable.$inferSelect)[] = [];
  for (const staff of candidateStaff) {
    const isCleaner =
      staff.staffCategory === "cleaning_staff" ||
      staff.role === "technician" ||
      (await staffHasOperationalRole(staff.id, OPERATIONAL_ROLE_SLUGS.DAILY_CAR_CLEANER));

    if (isCleaner) {
      // If zoneId specified, prioritize or require zone match if assigned
      if (!zoneId || !staff.assignedZoneId || staff.assignedZoneId === zoneId) {
        eligibleCleaners.push(staff);
      }
    }
  }

  // 4. Group / cluster subscriptions:
  // Primary cluster: Society
  // Secondary cluster: Tower
  // Sort order within Tower: parkingLevel asc, parkingBay asc
  type SubItem = (typeof eligibleSubs)[0];
  const societyClusters = new Map<number, Map<number, SubItem[]>>();

  for (const item of eligibleSubs) {
    const socId = item.society?.id ?? item.sub.societyId ?? 0;
    const towId = item.tower?.id ?? item.sub.towerId ?? 0;

    if (!societyClusters.has(socId)) {
      societyClusters.set(socId, new Map());
    }
    const towerMap = societyClusters.get(socId)!;
    if (!towerMap.has(towId)) {
      towerMap.set(towId, []);
    }
    towerMap.get(towId)!.push(item);
  }

  // Flatten clusters in contiguous operational order:
  // Society -> Tower -> parkingLevel -> parkingBay
  const sortedStopsToAssign: SubItem[] = [];
  for (const [, towerMap] of societyClusters.entries()) {
    for (const [, items] of towerMap.entries()) {
      items.sort((a, b) => {
        const levelA = a.serviceLoc?.parkingLevel ?? "";
        const levelB = b.serviceLoc?.parkingLevel ?? "";
        if (levelA !== levelB) return levelA.localeCompare(levelB);
        const bayA = a.sub.parkingBay ?? a.serviceLoc?.parkingBay ?? "";
        const bayB = b.sub.parkingBay ?? b.serviceLoc?.parkingBay ?? "";
        return bayA.localeCompare(bayB);
      });
      sortedStopsToAssign.push(...items);
    }
  }

  // 5. Workload Balancing Allocation
  // Distribute contiguous blocks of stops to eligible cleaners up to maxCarsCap
  const allocations: CleanerAssignmentBatch[] = [];
  const unassignedSubscriptions: UnassignedStop[] = [];

  let currentCleanerIdx = 0;
  let currentBatch: AllocatedRouteStop[] = [];
  let currentCleaner = eligibleCleaners[currentCleanerIdx];

  for (const item of sortedStopsToAssign) {
    if (!currentCleaner || (currentBatch.length >= maxCarsCap && currentCleanerIdx + 1 >= eligibleCleaners.length)) {
      // No more cleaners or all cleaners at capacity
      unassignedSubscriptions.push({
        subscriptionId: item.sub.id,
        vehicleNumber: item.vehicle.registrationNumber,
        societyName: item.society?.name ?? "General Society",
        reason:
          eligibleCleaners.length === 0
            ? "No available daily car cleaners in branch"
            : `All cleaners reached workload capacity (${maxCarsCap} cars/shift)`,
      });
      continue;
    }

    if (currentBatch.length >= maxCarsCap) {
      // Advance to next cleaner
      const socNames = Array.from(new Set(currentBatch.map((s) => s.societyName)));
      const towNames = Array.from(
        new Set(currentBatch.map((s) => s.towerName).filter(Boolean) as string[]),
      );
      allocations.push({
        staffId: currentCleaner.id,
        staffName: currentCleaner.name,
        staffPhone: currentCleaner.phone,
        totalAssigned: currentBatch.length,
        societies: socNames,
        towers: towNames,
        stops: currentBatch,
      });

      currentCleanerIdx++;
      currentCleaner = eligibleCleaners[currentCleanerIdx];
      currentBatch = [];
    }

    const routeOrder = currentBatch.length + 1;
    currentBatch.push({
      subscriptionId: item.sub.id,
      vehicleId: item.vehicle.id,
      vehicleNumber: item.vehicle.registrationNumber,
      vehicleMake: item.vehicle.make,
      vehicleModel: item.vehicle.model,
      societyId: item.society?.id ?? item.sub.societyId ?? 0,
      societyName: item.society?.name ?? "General Society",
      towerId: item.tower?.id ?? null,
      towerName: item.tower?.name ?? null,
      parkingLevel: item.serviceLoc?.parkingLevel ?? null,
      parkingBay: item.sub.parkingBay ?? item.serviceLoc?.parkingBay ?? null,
      routeOrder,
    });
  }

  // Final cleaner batch
  if (currentBatch.length > 0 && currentCleaner) {
    const socNames = Array.from(new Set(currentBatch.map((s) => s.societyName)));
    const towNames = Array.from(
      new Set(currentBatch.map((s) => s.towerName).filter(Boolean) as string[]),
    );
    allocations.push({
      staffId: currentCleaner.id,
      staffName: currentCleaner.name,
      staffPhone: currentCleaner.phone,
      totalAssigned: currentBatch.length,
      societies: socNames,
      towers: towNames,
      stops: currentBatch,
    });
  }

  const assignedCount = allocations.reduce((sum, b) => sum + b.totalAssigned, 0);

  // 6. Persistence (when !dryRun)
  if (!dryRun && allocations.length > 0) {
    const now = new Date();
    const assignedSubIdsToUpdate = allocations.flatMap((b) => b.stops.map((s) => s.subscriptionId));

    // Deactivate previous assignments if re-balancing
    if (forceRebalance && assignedSubIdsToUpdate.length > 0) {
      await db
        .update(dcmsStaffAssignmentsTable)
        .set({ isActive: false })
        .where(
          and(
            inArray(dcmsStaffAssignmentsTable.subscriptionId, assignedSubIdsToUpdate),
            eq(dcmsStaffAssignmentsTable.isActive, true),
          ),
        );
    }

    // Insert new assignment rows
    for (const batch of allocations) {
      for (const stop of batch.stops) {
        await db.insert(dcmsStaffAssignmentsTable).values({
          subscriptionId: stop.subscriptionId,
          staffId: batch.staffId,
          assignedBy,
          assignedAt: now,
          routeOrder: stop.routeOrder,
          isActive: true,
        });
      }
    }

    await logAdminAudit({
      action: "society_cluster_auto_assigned",
      entityType: "branch",
      entityId: branchId,
      branchId,
      performedBy: assignedBy,
      reason: `Auto-assigned ${assignedCount} daily cleaning jobs across ${allocations.length} cleaner(s)`,
      details: {
        branchId,
        societyId,
        maxCarsCap,
        assignedCount,
        cleanersUtilized: allocations.length,
        unassignedCount: unassignedSubscriptions.length,
      },
    });

    logger.info(
      { branchId, assignedCount, cleanersUtilized: allocations.length },
      `Completed society cluster auto-assignment for branch ${branchId}`,
    );
  }

  return {
    branchId,
    societyId,
    totalEligibleSubscriptions: eligibleSubs.length,
    assignedCount,
    unassignedCount: unassignedSubscriptions.length,
    cleanersAvailable: eligibleCleaners.length,
    cleanersUtilized: allocations.length,
    maxCarsCap,
    dryRun,
    allocations,
    unassignedSubscriptions,
  };
}
