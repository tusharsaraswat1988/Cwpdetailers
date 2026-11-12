import {
  db,
  branchesTable,
  franchiseesTable,
  legalEntitiesTable,
  citiesTable,
  usersTable,
  sessionsTable,
  type Branch,
  type Franchisee,
} from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { logger } from "../logger";

export type BranchWithDetails = {
  id: number;
  name: string;
  code: string | null;
  city: string;
  cityId: number | null;
  cityName: string | null;
  address: string | null;
  phone: string | null;
  managerName: string | null;
  companyId: number | null;
  franchiseeId: number | null;
  franchiseeName: string | null;
  legalEntityId: number | null;
  legalEntityName: string | null;
  isCompanyOperated: boolean;
  status: string;
  serviceAvailability: string[] | null;
  operationalNotes: string | null;
  isActive: boolean;
  createdAt: Date;
  customerCount: number;
  staffCount: number;
  activeSubscriptionsCount: number;
};

export type ListBranchesFilters = {
  cityId?: number;
  franchiseeId?: number;
  isCompanyOperated?: boolean;
  status?: string;
  companyId?: number;
};

export async function listBranchesDetailed(
  filters?: ListBranchesFilters,
): Promise<BranchWithDetails[]> {
  const conditions = [];
  if (filters?.cityId) conditions.push(eq(branchesTable.cityId, filters.cityId));
  if (filters?.franchiseeId) conditions.push(eq(branchesTable.franchiseeId, filters.franchiseeId));
  if (filters?.isCompanyOperated !== undefined) {
    conditions.push(eq(branchesTable.isCompanyOperated, filters.isCompanyOperated));
  }
  if (filters?.status) conditions.push(eq(branchesTable.status, filters.status));
  if (filters?.companyId) conditions.push(eq(branchesTable.companyId, filters.companyId));

  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: branchesTable.id,
      name: branchesTable.name,
      code: branchesTable.code,
      city: branchesTable.city,
      cityId: branchesTable.cityId,
      cityName: citiesTable.name,
      address: branchesTable.address,
      phone: branchesTable.phone,
      managerName: branchesTable.managerName,
      companyId: branchesTable.companyId,
      franchiseeId: branchesTable.franchiseeId,
      franchiseeName: franchiseesTable.name,
      legalEntityId: branchesTable.legalEntityId,
      legalEntityName: legalEntitiesTable.name,
      isCompanyOperated: branchesTable.isCompanyOperated,
      status: branchesTable.status,
      serviceAvailability: branchesTable.serviceAvailability,
      operationalNotes: branchesTable.operationalNotes,
      isActive: branchesTable.isActive,
      createdAt: branchesTable.createdAt,
      customerCount: sql<number>`(SELECT COUNT(*)::int FROM customers c WHERE c.branch_id = ${branchesTable.id})`,
      staffCount: sql<number>`(SELECT COUNT(*)::int FROM staff s WHERE s.branch_id = ${branchesTable.id})`,
      activeSubscriptionsCount: sql<number>`(SELECT COUNT(*)::int FROM dcms_subscriptions sub WHERE sub.branch_id = ${branchesTable.id} AND sub.status = 'active')`,
    })
    .from(branchesTable)
    .leftJoin(citiesTable, eq(branchesTable.cityId, citiesTable.id))
    .leftJoin(franchiseesTable, eq(branchesTable.franchiseeId, franchiseesTable.id))
    .leftJoin(legalEntitiesTable, eq(branchesTable.legalEntityId, legalEntitiesTable.id))
    .where(where)
    .orderBy(desc(branchesTable.createdAt));

  return rows as BranchWithDetails[];
}

export type CreateBranchInput = {
  name: string;
  code?: string;
  city: string;
  cityId?: number;
  address?: string;
  phone?: string;
  managerName?: string;
  companyId?: number;
  franchiseeId?: number;
  legalEntityId?: number;
  isCompanyOperated?: boolean;
  serviceAvailability?: string[];
  operationalNotes?: string;
};

export async function createBranch(
  input: CreateBranchInput,
  performedBy: number,
): Promise<Branch> {
  const isCompanyOperated = input.isCompanyOperated ?? !input.franchiseeId;
  const code =
    input.code?.trim() ||
    `BR-${input.city.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;

  const [created] = await db
    .insert(branchesTable)
    .values({
      name: input.name.trim(),
      code,
      city: input.city.trim(),
      cityId: input.cityId ?? null,
      address: input.address?.trim() ?? null,
      phone: input.phone?.trim() ?? null,
      managerName: input.managerName?.trim() ?? null,
      companyId: input.companyId ?? null,
      franchiseeId: input.franchiseeId ?? null,
      legalEntityId: input.legalEntityId ?? null,
      isCompanyOperated,
      status: "active",
      serviceAvailability: input.serviceAvailability ?? ["daily_cleaning", "car_washing"],
      operationalNotes: input.operationalNotes?.trim() ?? null,
      isActive: true,
    })
    .returning();

  logger.info(
    {
      action: "branch_created",
      branchId: created!.id,
      isCompanyOperated,
      performedBy,
    },
    `Branch "${created!.name}" (${code}) created`,
  );

  return created!;
}

export async function suspendBranch(
  branchId: number,
  reason: string,
  performedBy: number,
): Promise<Branch> {
  const [existing] = await db
    .select()
    .from(branchesTable)
    .where(eq(branchesTable.id, branchId))
    .limit(1);

  if (!existing) throw new Error("Branch not found");

  const [updated] = await db
    .update(branchesTable)
    .set({
      status: "suspended",
      isActive: false,
      operationalNotes: `[Suspended on ${new Date().toISOString()}] Reason: ${reason}. Previous notes: ${existing.operationalNotes ?? ""}`,
      updatedAt: new Date(),
    })
    .where(eq(branchesTable.id, branchId))
    .returning();

  // Revoke active sessions for staff/managers of this branch
  await db
    .update(sessionsTable)
    .set({ revokedAt: new Date() })
    .where(
      sql`${sessionsTable.userId} IN (SELECT id FROM users WHERE branch_id = ${branchId} AND role <> 'admin' AND role <> 'superadmin')`,
    );

  logger.warn(
    { action: "branch_suspended", branchId, reason, performedBy },
    `Branch ${branchId} suspended: ${reason}`,
  );

  return updated!;
}

export async function activateBranch(
  branchId: number,
  performedBy: number,
): Promise<Branch> {
  const [updated] = await db
    .update(branchesTable)
    .set({
      status: "active",
      isActive: true,
      updatedAt: new Date(),
    })
    .where(eq(branchesTable.id, branchId))
    .returning();

  if (!updated) throw new Error("Branch not found");

  logger.info({ action: "branch_activated", branchId, performedBy }, `Branch ${branchId} activated`);
  return updated;
}

export type FranchiseeWithMetrics = {
  id: number;
  userId: number | null;
  branchId: number | null;
  branchName: string | null;
  cityId: number | null;
  cityName: string | null;
  legalEntityId: number | null;
  legalEntityName: string | null;
  name: string;
  phone: string;
  email: string | null;
  secondaryPhone: string | null;
  currentAddress: string | null;
  permanentAddress: string | null;
  aadhaar: string | null;
  pan: string | null;
  agreementNumber: string | null;
  commissionPercentage: string | null;
  status: string;
  suspensionReason: string | null;
  finalAmountAgreed: string | null;
  amountDeposited: string | null;
  dueAmount: string | null;
  staffCount: number;
  activeSubscriptionsCount: number;
  createdAt: Date;
};

export async function listFranchiseesDetailed(
  filters?: { cityId?: number; status?: string; companyId?: number },
): Promise<FranchiseeWithMetrics[]> {
  const conditions = [];
  if (filters?.cityId) conditions.push(eq(franchiseesTable.cityId, filters.cityId));
  if (filters?.status) conditions.push(eq(franchiseesTable.status, filters.status as any));
  if (filters?.companyId) conditions.push(eq(franchiseesTable.companyId, filters.companyId));

  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: franchiseesTable.id,
      userId: franchiseesTable.userId,
      branchId: franchiseesTable.branchId,
      branchName: branchesTable.name,
      cityId: franchiseesTable.cityId,
      cityName: citiesTable.name,
      legalEntityId: franchiseesTable.legalEntityId,
      legalEntityName: legalEntitiesTable.name,
      name: franchiseesTable.name,
      phone: franchiseesTable.phone,
      email: franchiseesTable.email,
      secondaryPhone: franchiseesTable.secondaryPhone,
      currentAddress: franchiseesTable.currentAddress,
      permanentAddress: franchiseesTable.permanentAddress,
      aadhaar: franchiseesTable.aadhaar,
      pan: franchiseesTable.pan,
      agreementNumber: franchiseesTable.agreementNumber,
      commissionPercentage: franchiseesTable.commissionPercentage,
      status: franchiseesTable.status,
      suspensionReason: franchiseesTable.suspensionReason,
      finalAmountAgreed: franchiseesTable.finalAmountAgreed,
      amountDeposited: franchiseesTable.amountDeposited,
      dueAmount: franchiseesTable.dueAmount,
      staffCount: sql<number>`(SELECT COUNT(*)::int FROM staff s WHERE s.franchisee_id = ${franchiseesTable.id})`,
      activeSubscriptionsCount: sql<number>`(SELECT COUNT(*)::int FROM dcms_subscriptions sub WHERE sub.franchisee_id = ${franchiseesTable.id} AND sub.status = 'active')`,
      createdAt: franchiseesTable.createdAt,
    })
    .from(franchiseesTable)
    .leftJoin(branchesTable, eq(franchiseesTable.branchId, branchesTable.id))
    .leftJoin(citiesTable, eq(franchiseesTable.cityId, citiesTable.id))
    .leftJoin(legalEntitiesTable, eq(franchiseesTable.legalEntityId, legalEntitiesTable.id))
    .where(where)
    .orderBy(desc(franchiseesTable.createdAt));

  return rows as FranchiseeWithMetrics[];
}

export async function suspendFranchisee(
  franchiseeId: number,
  reason: string,
  performedBy: number,
): Promise<Franchisee> {
  const [existing] = await db
    .select()
    .from(franchiseesTable)
    .where(eq(franchiseesTable.id, franchiseeId))
    .limit(1);

  if (!existing) throw new Error("Franchisee not found");

  const now = new Date();
  const [updated] = await db
    .update(franchiseesTable)
    .set({
      status: "suspended",
      suspensionReason: reason,
      suspendedAt: now,
      suspendedBy: performedBy,
      updatedAt: now,
    })
    .where(eq(franchiseesTable.id, franchiseeId))
    .returning();

  // Revoke active sessions for franchisee user login
  if (existing.userId) {
    await db
      .update(sessionsTable)
      .set({ revokedAt: now })
      .where(eq(sessionsTable.userId, existing.userId));
  }

  // Also suspend associated branch if FOFO
  if (existing.branchId) {
    await db
      .update(branchesTable)
      .set({
        status: "suspended",
        isActive: false,
        updatedAt: now,
      })
      .where(eq(branchesTable.id, existing.branchId));
  }

  logger.warn(
    { action: "franchisee_suspended", franchiseeId, reason, performedBy },
    `Franchisee ${franchiseeId} (${existing.name}) suspended: ${reason}`,
  );

  return updated!;
}

export async function activateFranchisee(
  franchiseeId: number,
  performedBy: number,
): Promise<Franchisee> {
  const now = new Date();
  const [updated] = await db
    .update(franchiseesTable)
    .set({
      status: "active",
      suspensionReason: null,
      suspendedAt: null,
      suspendedBy: null,
      updatedAt: now,
    })
    .where(eq(franchiseesTable.id, franchiseeId))
    .returning();

  if (!updated) throw new Error("Franchisee not found");

  if (updated.branchId) {
    await db
      .update(branchesTable)
      .set({
        status: "active",
        isActive: true,
        updatedAt: now,
      })
      .where(eq(branchesTable.id, updated.branchId));
  }

  logger.info({ action: "franchisee_activated", franchiseeId, performedBy }, `Franchisee ${franchiseeId} activated`);
  return updated;
}
