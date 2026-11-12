import {
  db,
  branchesTable,
  franchiseesTable,
  legalEntitiesTable,
  citiesTable,
  usersTable,
  sessionsTable,
  staffTable,
  type Branch,
  type Franchisee,
} from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { logger } from "../logger";
import { logAdminAudit } from "../audit/adminAuditService";

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

export type BranchReadinessItem = {
  key: string;
  label: string;
  passed: boolean;
  message: string;
  critical: boolean;
};

export type BranchReadinessReport = {
  branchId: number;
  branchName: string;
  isReady: boolean;
  score: number;
  status: string;
  isCompanyOperated: boolean;
  checklist: BranchReadinessItem[];
  missingPrerequisites: string[];
};

export async function validateBranchReadiness(branchId: number): Promise<BranchReadinessReport> {
  const [branch] = await db
    .select()
    .from(branchesTable)
    .where(eq(branchesTable.id, branchId))
    .limit(1);

  if (!branch) throw new Error("Branch not found");

  const checklist: BranchReadinessItem[] = [];

  // 1. Basic profile & code
  const hasBasicInfo = Boolean(branch.name?.trim() && branch.code?.trim() && branch.city?.trim());
  checklist.push({
    key: "basic_profile",
    label: "Branch Identity & Code",
    passed: hasBasicInfo,
    message: hasBasicInfo ? `Code: ${branch.code}` : "Missing name or branch code",
    critical: true,
  });

  // 2. City assignment & active status
  let cityActive = false;
  let cityName = branch.city;
  if (branch.cityId) {
    const [city] = await db.select().from(citiesTable).where(eq(citiesTable.id, branch.cityId)).limit(1);
    cityActive = Boolean(city && city.isActive);
    if (city) cityName = city.name;
  }
  checklist.push({
    key: "city_assignment",
    label: "Active City Assignment",
    passed: Boolean(branch.cityId && cityActive),
    message: branch.cityId && cityActive ? `Mapped to active city: ${cityName}` : "City missing or inactive",
    critical: true,
  });

  // 3. Issuing Legal Entity
  let legalEntityAssigned = false;
  if (branch.legalEntityId) {
    const [le] = await db.select().from(legalEntitiesTable).where(eq(legalEntitiesTable.id, branch.legalEntityId)).limit(1);
    legalEntityAssigned = Boolean(le && le.isActive);
  }
  checklist.push({
    key: "legal_entity",
    label: "Issuing Legal Entity & GST",
    passed: legalEntityAssigned,
    message: legalEntityAssigned ? "Legal entity configured for invoicing" : "No legal entity assigned for billing",
    critical: true,
  });

  // 4. Operating Model Configured (COCO vs FOFO)
  checklist.push({
    key: "operating_model",
    label: "Operating Model Configuration",
    passed: true,
    message: branch.isCompanyOperated ? "Company-Operated (COCO)" : "Franchise-Operated (FOFO)",
    critical: true,
  });

  // 5. Franchise Partner Linkage (for FOFO)
  if (!branch.isCompanyOperated) {
    let franchiseValid = false;
    let franMsg = "No franchise partner linked";
    if (branch.franchiseeId) {
      const [fr] = await db.select().from(franchiseesTable).where(eq(franchiseesTable.id, branch.franchiseeId)).limit(1);
      if (fr) {
        franchiseValid = fr.status === "active" || fr.status === "onboarding";
        franMsg = franchiseValid ? `Partner: ${fr.name} (${fr.status})` : `Partner ${fr.name} is ${fr.status}`;
      }
    }
    checklist.push({
      key: "franchise_partner",
      label: "Franchise Partner Agreement",
      passed: franchiseValid,
      message: franMsg,
      critical: true,
    });
  } else {
    checklist.push({
      key: "franchise_partner",
      label: "Franchise Partner Agreement",
      passed: true,
      message: "Not required for COCO model",
      critical: false,
    });
  }

  // 6. Service Availability configured
  const services = branch.serviceAvailability ?? [];
  const hasServices = Array.isArray(services) && services.length > 0;
  checklist.push({
    key: "services_configured",
    label: "Service Catalog Availability",
    passed: hasServices,
    message: hasServices ? `${services.length} services enabled (${services.join(", ")})` : "No services enabled for branch",
    critical: true,
  });

  // 7. Staff & Resource Allocation
  const [staffCountRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(staffTable)
    .where(and(eq(staffTable.branchId, branchId), eq(staffTable.isActive, true)));
  const staffCount = staffCountRes?.count ?? 0;
  checklist.push({
    key: "staff_allocated",
    label: "Operational Staff Allocation",
    passed: staffCount > 0,
    message: staffCount > 0 ? `${staffCount} active staff members allocated` : "No active staff allocated to branch",
    critical: true,
  });

  // 8. Contact & Manager Information
  const hasContact = Boolean(branch.phone?.trim() || branch.managerName?.trim());
  checklist.push({
    key: "operational_contact",
    label: "Branch Manager & Contact Details",
    passed: hasContact,
    message: hasContact ? `Manager: ${branch.managerName || "Assigned"} (${branch.phone || "Phone on file"})` : "Missing contact phone or manager name",
    critical: false,
  });

  // 9. Operational Notes & Territorial Policy
  checklist.push({
    key: "operational_notes",
    label: "Territorial & Operational Guidelines",
    passed: Boolean(branch.operationalNotes?.trim()),
    message: branch.operationalNotes ? "Operational instructions recorded" : "No operational notes provided (recommended)",
    critical: false,
  });

  // Calculate score and completeness
  const criticalItems = checklist.filter((item) => item.critical);
  const criticalPassed = criticalItems.every((item) => item.passed);
  const totalPassed = checklist.filter((item) => item.passed).length;
  const score = Math.round((totalPassed / checklist.length) * 100);

  const missingPrerequisites = checklist
    .filter((item) => !item.passed)
    .map((item) => `${item.label} (${item.message})`);

  return {
    branchId: branch.id,
    branchName: branch.name,
    isReady: criticalPassed,
    score,
    status: branch.status,
    isCompanyOperated: branch.isCompanyOperated,
    checklist,
    missingPrerequisites,
  };
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

  await logAdminAudit({
    action: "branch_suspended",
    entityType: "branch",
    entityId: branchId,
    cityId: updated!.cityId,
    branchId,
    performedBy,
    reason,
  });

  logger.warn(
    { action: "branch_suspended", branchId, reason, performedBy },
    `Branch ${branchId} suspended: ${reason}`,
  );

  return updated!;
}

export async function activateBranch(
  branchId: number,
  performedBy: number,
  force = false,
): Promise<Branch> {
  const readiness = await validateBranchReadiness(branchId);
  if (!readiness.isReady && !force) {
    throw new Error(
      `Branch is not ready for activation. Missing critical prerequisites: ${readiness.missingPrerequisites.join("; ")}`,
    );
  }

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

  await logAdminAudit({
    action: "branch_activated",
    entityType: "branch",
    entityId: branchId,
    cityId: updated.cityId,
    branchId,
    performedBy,
    reason: force ? "Forced activation by admin" : "Setup readiness checklist verified",
    details: { score: readiness.score },
  });

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

  await logAdminAudit({
    action: "franchisee_suspended",
    entityType: "franchisee",
    entityId: franchiseeId,
    cityId: existing.cityId,
    branchId: existing.branchId,
    performedBy,
    reason,
  });

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

  await logAdminAudit({
    action: "franchisee_activated",
    entityType: "franchisee",
    entityId: franchiseeId,
    cityId: updated.cityId,
    branchId: updated.branchId,
    performedBy,
  });

  logger.info({ action: "franchisee_activated", franchiseeId, performedBy }, `Franchisee ${franchiseeId} activated`);
  return updated;
}
