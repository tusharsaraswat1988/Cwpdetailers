import {
  db,
  citiesTable,
  statesTable,
  branchesTable,
  branchUserAssignmentsTable,
  serviceCityAvailabilityTable,
  servicesTable,
  legalEntitiesTable,
  serviceAreasTable,
  customersTable,
  dcmsSubscriptionsTable,
  bookingsTable,
  invoicesTable,
  usersTable,
  sessionsTable,
  type City,
} from "@workspace/db";
import { eq, and, sql, inArray, isNull, desc } from "drizzle-orm";
import { logAdminAudit } from "./audit/adminAuditService";
import { logger } from "./logger";

export type CityStatus = "draft" | "setup_in_progress" | "ready_for_launch" | "active" | "suspended" | "archived";

export type CityChecklistItem = {
  id: string;
  category: string;
  title: string;
  description: string;
  passed: boolean;
  details: string;
  critical: boolean;
};

export type CityReadinessReport = {
  cityId: number;
  cityName: string;
  cityCode: string | null;
  status: CityStatus;
  isReady: boolean;
  score: number;
  passedCount: number;
  totalCount: number;
  checklist: CityChecklistItem[];
  blockingReasons: string[];
};

export type CreateCityInput = {
  stateId: number;
  name: string;
  slug?: string;
  code?: string;
  timezone?: string;
  currency?: string;
  locale?: string;
  contactPhone?: string;
  contactEmail?: string;
  operationalSettings?: Record<string, unknown>;
  contentSettings?: Record<string, unknown>;
};

export type CityOperationsDashboard = {
  cityId: number;
  cityName: string;
  cityCode: string | null;
  status: string;
  activeBranchesCount: number;
  totalBranchesCount: number;
  activeStaffCount: number;
  activeSupervisorsCount: number;
  activeCustomersCount: number;
  activeDcmsSubscriptionsCount: number;
  todayJobsScheduled: number;
  todayJobsCompleted: number;
  todayCompletionRate: number;
  monthlyCollections: number;
};

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/**
 * Creates a new operating city in setup_in_progress or draft status (PRD v4.0, CITY-001)
 */
export async function createCity(input: CreateCityInput, adminId: number): Promise<City> {
  const name = input.name.trim();
  const slug = (input.slug || slugify(name)).toLowerCase().trim();
  const code = (input.code || slug.slice(0, 3)).toUpperCase().trim();

  // Validate state
  const [state] = await db.select().from(statesTable).where(eq(statesTable.id, input.stateId)).limit(1);
  if (!state) {
    throw new Error(`State with ID ${input.stateId} does not exist`);
  }

  // Check unique slug & code
  const [existingSlug] = await db.select().from(citiesTable).where(eq(citiesTable.slug, slug)).limit(1);
  if (existingSlug) {
    throw new Error(`City with slug "${slug}" already exists`);
  }

  if (code) {
    const [existingCode] = await db.select().from(citiesTable).where(eq(citiesTable.code, code)).limit(1);
    if (existingCode) {
      throw new Error(`City with code "${code}" already exists`);
    }
  }

  const [city] = await db
    .insert(citiesTable)
    .values({
      stateId: input.stateId,
      name,
      slug,
      code,
      status: "setup_in_progress",
      timezone: input.timezone || "Asia/Kolkata",
      currency: input.currency || "INR",
      locale: input.locale || "en-IN",
      contactPhone: input.contactPhone || null,
      contactEmail: input.contactEmail || null,
      operationalSettings: input.operationalSettings || {},
      contentSettings: input.contentSettings || {},
      isActive: true,
    })
    .returning();

  await logAdminAudit({
    action: "create_city",
    entityType: "city",
    entityId: city.id,
    cityId: city.id,
    performedBy: adminId,
    details: { name: city.name, code: city.code, slug: city.slug },
  });

  return city;
}

/**
 * Updates city configuration and settings
 */
export async function updateCity(
  cityId: number,
  patch: Partial<CreateCityInput> & { status?: CityStatus; isActive?: boolean },
  adminId: number,
): Promise<City> {
  const [existing] = await db.select().from(citiesTable).where(eq(citiesTable.id, cityId)).limit(1);
  if (!existing) {
    throw new Error(`City with ID ${cityId} not found`);
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (patch.name !== undefined) updateData.name = patch.name.trim();
  if (patch.slug !== undefined) updateData.slug = patch.slug.toLowerCase().trim();
  if (patch.code !== undefined) updateData.code = patch.code.toUpperCase().trim();
  if (patch.stateId !== undefined) updateData.stateId = patch.stateId;
  if (patch.timezone !== undefined) updateData.timezone = patch.timezone;
  if (patch.currency !== undefined) updateData.currency = patch.currency;
  if (patch.locale !== undefined) updateData.locale = patch.locale;
  if (patch.contactPhone !== undefined) updateData.contactPhone = patch.contactPhone;
  if (patch.contactEmail !== undefined) updateData.contactEmail = patch.contactEmail;
  if (patch.operationalSettings !== undefined) updateData.operationalSettings = patch.operationalSettings;
  if (patch.contentSettings !== undefined) updateData.contentSettings = patch.contentSettings;
  if (patch.status !== undefined) updateData.status = patch.status;
  if (patch.isActive !== undefined) updateData.isActive = patch.isActive;

  const [updated] = await db.update(citiesTable).set(updateData).where(eq(citiesTable.id, cityId)).returning();

  await logAdminAudit({
    action: "update_city",
    entityType: "city",
    entityId: cityId,
    cityId,
    performedBy: adminId,
    details: patch,
  });

  return updated;
}

/**
 * Dynamic 10-point prerequisite checklist evaluating city launch readiness (PRD v4.0, CITY-003)
 */
export async function validateCityReadiness(cityId: number): Promise<CityReadinessReport> {
  const [city] = await db.select().from(citiesTable).where(eq(citiesTable.id, cityId)).limit(1);
  if (!city) {
    throw new Error(`City with ID ${cityId} not found`);
  }

  // 1. Profile and contact info
  const hasProfile = Boolean(city.name && city.code && city.stateId && city.contactPhone);
  const profileItem: CityChecklistItem = {
    id: "profile_and_contact",
    category: "Identity & Contact",
    title: "City Profile & Contact Channels",
    description: "City name, 3-letter code, state link, and customer contact phone configured.",
    passed: hasProfile,
    details: hasProfile
      ? `Configured (${city.code}, ${city.contactPhone || "No direct phone"})`
      : "Missing city code, state, or contact phone.",
    critical: true,
  };

  // 2. Operational settings
  const hasOpsSettings = Boolean(city.timezone && city.currency && city.locale);
  const opsSettingsItem: CityChecklistItem = {
    id: "operational_settings",
    category: "Operations",
    title: "Timezone, Currency & Regional Locale",
    description: "Operating timezone, billing currency, and standard locale configured.",
    passed: hasOpsSettings,
    details: `${city.timezone} | ${city.currency} | ${city.locale}`,
    critical: false,
  };

  // 3. Legal Entity
  const legalEntities = await db
    .select({ id: legalEntitiesTable.id, name: legalEntitiesTable.name })
    .from(legalEntitiesTable)
    .where(eq(legalEntitiesTable.isActive, true))
    .limit(5);
  const hasLegalEntity = legalEntities.length > 0;
  const legalEntityItem: CityChecklistItem = {
    id: "legal_entity",
    category: "Compliance & GST",
    title: "Registered Legal Entity & GST",
    description: "At least one active legal entity registered for tax compliance and invoicing.",
    passed: hasLegalEntity,
    details: hasLegalEntity
      ? `${legalEntities.length} active legal entities available`
      : "No active legal entity found. Configure under /admin/legal-entities",
    critical: true,
  };

  // 4. Service catalog enablement
  const cityServices = await db
    .select({
      id: serviceCityAvailabilityTable.id,
      serviceId: serviceCityAvailabilityTable.serviceId,
      isActive: serviceCityAvailabilityTable.isActive,
      basePriceOverride: serviceCityAvailabilityTable.basePriceOverride,
      serviceName: servicesTable.name,
      globalBasePrice: servicesTable.basePrice,
    })
    .from(serviceCityAvailabilityTable)
    .innerJoin(servicesTable, eq(serviceCityAvailabilityTable.serviceId, servicesTable.id))
    .where(
      and(
        eq(serviceCityAvailabilityTable.cityId, cityId),
        eq(serviceCityAvailabilityTable.isActive, true),
        eq(servicesTable.isActive, true),
      ),
    );

  const hasServices = cityServices.length > 0;
  const serviceCatalogItem: CityChecklistItem = {
    id: "service_catalog",
    category: "Catalog",
    title: "City Service Availability",
    description: "At least one active service enabled in this city's catalog availability matrix.",
    passed: hasServices,
    details: hasServices
      ? `${cityServices.length} active services enabled for ${city.name}`
      : "No active services enabled. Enable in Service Catalog Availability Matrix.",
    critical: true,
  };

  // 5. Pricing configured
  const validPricingCount = cityServices.filter((s) => {
    const eff = parseFloat(s.basePriceOverride?.toString() || s.globalBasePrice?.toString() || "0");
    return eff > 0;
  }).length;
  const hasValidPricing = hasServices && validPricingCount === cityServices.length;
  const pricingItem: CityChecklistItem = {
    id: "pricing_configured",
    category: "Catalog",
    title: "Service Pricing & Overrides",
    description: "All enabled services have positive baseline or city-override prices configured.",
    passed: hasValidPricing,
    details: hasServices
      ? `${validPricingCount}/${cityServices.length} services have valid pricing`
      : "No enabled services to price",
    critical: true,
  };

  // 6. Operating branch (COCO)
  const cityBranches = await db
    .select({
      id: branchesTable.id,
      name: branchesTable.name,
      code: branchesTable.code,
      status: branchesTable.status,
      isCompanyOperated: branchesTable.isCompanyOperated,
    })
    .from(branchesTable)
    .where(
      and(
        eq(branchesTable.cityId, cityId),
        eq(branchesTable.status, "active"),
        eq(branchesTable.isActive, true),
      ),
    );

  const hasCocoBranch = cityBranches.some((b) => b.isCompanyOperated);
  const branchItem: CityChecklistItem = {
    id: "operating_branch",
    category: "Infrastructure",
    title: "Active Company-Operated (COCO) Branch",
    description: "At least one active Company-Operated branch established in this city.",
    passed: hasCocoBranch,
    details: hasCocoBranch
      ? `${cityBranches.length} active branch(es) registered`
      : "No active COCO branch found for this city. Create one in /admin/branches",
    critical: true,
  };

  // 7. Branch Manager assignment
  const branchIds = cityBranches.map((b) => b.id);
  let hasManager = false;
  if (branchIds.length > 0) {
    const managers = await db
      .select({ id: branchUserAssignmentsTable.id })
      .from(branchUserAssignmentsTable)
      .where(
        and(
          inArray(branchUserAssignmentsTable.branchId, branchIds),
          eq(branchUserAssignmentsTable.isActive, true),
          inArray(branchUserAssignmentsTable.assignmentRole, ["manager", "branch_manager", "lead_manager"]),
          isNull(branchUserAssignmentsTable.revokedAt),
        ),
      )
      .limit(1);
    hasManager = managers.length > 0;
  }

  const managerItem: CityChecklistItem = {
    id: "branch_manager",
    category: "Governance & RBAC",
    title: "Appointed Branch Manager",
    description: "At least one verified branch manager assigned via branch_user_assignments.",
    passed: hasManager,
    details: hasManager
      ? "Active branch manager assigned and verified"
      : "No active branch manager assigned. Appoint a manager in Branch Governance.",
    critical: true,
  };

  // 8. Field supervisor or staff readiness
  let hasStaffOrSupervisor = false;
  if (branchIds.length > 0) {
    const staff = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(
        and(
          inArray(usersTable.branchId, branchIds),
          inArray(usersTable.role, ["staff", "supervisor"]),
          eq(usersTable.isActive, true),
        ),
      )
      .limit(1);
    hasStaffOrSupervisor = staff.length > 0;
  }

  const staffItem: CityChecklistItem = {
    id: "supervisor_or_staff",
    category: "Workforce",
    title: "Operational Staff / Supervisors",
    description: "At least one active field supervisor or service detailer enrolled in this city's branches.",
    passed: hasStaffOrSupervisor,
    details: hasStaffOrSupervisor
      ? "Active workforce enrolled"
      : "No staff or supervisors enrolled in city branches yet.",
    critical: false,
  };

  // 9. Coverage zones / localities
  const serviceAreas = await db
    .select({ id: serviceAreasTable.id, name: serviceAreasTable.name })
    .from(serviceAreasTable)
    .where(and(eq(serviceAreasTable.cityId, cityId), eq(serviceAreasTable.isActive, true)))
    .limit(5);

  const hasCoverage = serviceAreas.length > 0;
  const coverageItem: CityChecklistItem = {
    id: "coverage_zones",
    category: "Geography",
    title: "Service Areas & Coverage Zones",
    description: "At least one active service area, locality, or society defined for operational dispatch.",
    passed: hasCoverage,
    details: hasCoverage
      ? `${serviceAreas.length} active service areas mapped`
      : "No service areas defined. Configure in Master Data / Coverage.",
    critical: false,
  };

  // 10. Operational Policies
  const opsSettings = (city.operationalSettings || {}) as Record<string, unknown>;
  const hasPolicies = Object.keys(opsSettings).length > 0 || Boolean(city.contactPhone);
  const policyItem: CityChecklistItem = {
    id: "operational_policies",
    category: "Policy & SLA",
    title: "Operational Rules & SLA Policies",
    description: "Cancellation, dispatch windows, and operating hours policies defined.",
    passed: hasPolicies,
    details: hasPolicies ? "Policies configured" : "Using system defaults",
    critical: false,
  };

  const checklist: CityChecklistItem[] = [
    profileItem,
    opsSettingsItem,
    legalEntityItem,
    serviceCatalogItem,
    pricingItem,
    branchItem,
    managerItem,
    staffItem,
    coverageItem,
    policyItem,
  ];

  const passedCount = checklist.filter((c) => c.passed).length;
  const criticalItems = checklist.filter((c) => c.critical);
  const isReady = criticalItems.every((c) => c.passed);
  const score = Math.round((passedCount / checklist.length) * 100);

  const blockingReasons = criticalItems.filter((c) => !c.passed).map((c) => `${c.title}: ${c.details}`);

  return {
    cityId: city.id,
    cityName: city.name,
    cityCode: city.code,
    status: city.status as CityStatus,
    isReady,
    score,
    passedCount,
    totalCount: checklist.length,
    checklist,
    blockingReasons,
  };
}

/**
 * Activates a city for public operations, requiring readiness checklist pass unless forced (PRD v4.0, CITY-001)
 */
export async function activateCity(cityId: number, adminId: number, force = false): Promise<City> {
  const readiness = await validateCityReadiness(cityId);

  if (!readiness.isReady && !force) {
    throw new Error(
      `Cannot activate city "${readiness.cityName}". Critical readiness requirements not met: ${readiness.blockingReasons.join("; ")}`,
    );
  }

  const [city] = await db
    .update(citiesTable)
    .set({
      status: "active",
      isActive: true,
      launchedAt: sql`COALESCE(cities.launched_at, NOW())`,
      suspendedAt: null,
      suspensionReason: null,
      updatedAt: new Date(),
    })
    .where(eq(citiesTable.id, cityId))
    .returning();

  await logAdminAudit({
    action: "activate_city",
    entityType: "city",
    entityId: cityId,
    cityId,
    performedBy: adminId,
    details: { force, score: readiness.score, passedCount: readiness.passedCount },
  });

  return city;
}

/**
 * Suspends a city and invalidates active sessions of city-scoped users (PRD v4.0, CITY-001, CITY-007)
 */
export async function suspendCity(cityId: number, reason: string, adminId: number): Promise<City> {
  if (!reason || reason.trim().length === 0) {
    throw new Error("A specific suspension reason is required");
  }

  const [city] = await db
    .update(citiesTable)
    .set({
      status: "suspended",
      suspendedAt: new Date(),
      suspensionReason: reason.trim(),
      updatedAt: new Date(),
    })
    .where(eq(citiesTable.id, cityId))
    .returning();

  // Find branches in this city
  const cityBranches = await db
    .select({ id: branchesTable.id })
    .from(branchesTable)
    .where(eq(branchesTable.cityId, cityId));
  const branchIds = cityBranches.map((b) => b.id);

  // Invalidate sessions of city-scoped users
  const userConditions = [eq(usersTable.cityId, cityId)];
  if (branchIds.length > 0) {
    userConditions.push(inArray(usersTable.branchId, branchIds));
  }

  const cityUsers = await db
    .select({ id: usersTable.id, role: usersTable.role })
    .from(usersTable)
    .where(
      and(
        sql`(${usersTable.cityId} = ${cityId} OR (${branchIds.length > 0 ? sql`${inArray(usersTable.branchId, branchIds)}` : sql`false`}))`,
        sql`${usersTable.role} NOT IN ('superadmin', 'central_admin')`,
      ),
    );

  const userIdsToRevoke = cityUsers.map((u) => u.id);
  if (userIdsToRevoke.length > 0) {
    await db
      .update(sessionsTable)
      .set({ revokedAt: new Date() })
      .where(and(inArray(sessionsTable.userId, userIdsToRevoke), isNull(sessionsTable.revokedAt)));
  }

  await logAdminAudit({
    action: "suspend_city",
    entityType: "city",
    entityId: cityId,
    cityId,
    performedBy: adminId,
    reason,
    details: { revokedUsersCount: userIdsToRevoke.length },
  });

  return city;
}

/**
 * Archives a city without deleting historical records (PRD v4.0, CITY-001)
 */
export async function archiveCity(cityId: number, adminId: number): Promise<City> {
  const [city] = await db
    .update(citiesTable)
    .set({
      status: "archived",
      isActive: false,
      archivedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(citiesTable.id, cityId))
    .returning();

  await logAdminAudit({
    action: "archive_city",
    entityType: "city",
    entityId: cityId,
    cityId,
    performedBy: adminId,
    details: { archivedAt: city.archivedAt },
  });

  return city;
}

/**
 * Aggregates consolidated city operations dashboard metrics (PRD v4.0, CITY-004)
 */
export async function getCityOperationsDashboard(cityId: number): Promise<CityOperationsDashboard> {
  const [city] = await db.select().from(citiesTable).where(eq(citiesTable.id, cityId)).limit(1);
  if (!city) {
    throw new Error(`City with ID ${cityId} not found`);
  }

  // Branches
  const allBranches = await db.select().from(branchesTable).where(eq(branchesTable.cityId, cityId));
  const activeBranches = allBranches.filter((b) => b.status === "active" && b.isActive);
  const branchIds = allBranches.map((b) => b.id);

  // Workforce
  let activeStaffCount = 0;
  let activeSupervisorsCount = 0;
  if (branchIds.length > 0) {
    const staffMembers = await db
      .select({ id: usersTable.id, role: usersTable.role })
      .from(usersTable)
      .where(
        and(
          inArray(usersTable.branchId, branchIds),
          eq(usersTable.isActive, true),
          inArray(usersTable.role, ["staff", "supervisor"]),
        ),
      );
    activeStaffCount = staffMembers.filter((s) => s.role === "staff").length;
    activeSupervisorsCount = staffMembers.filter((s) => s.role === "supervisor").length;
  }

  // Customers
  const [customerCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(customersTable)
    .where(and(eq(customersTable.cityId, cityId), eq(customersTable.status, "active")));
  const activeCustomersCount = customerCountRow?.count ?? 0;

  // DCMS Subscriptions
  let activeDcmsSubscriptionsCount = 0;
  try {
    const [subCountRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(dcmsSubscriptionsTable)
      .where(
        and(
          eq(dcmsSubscriptionsTable.cityId, cityId),
          inArray(dcmsSubscriptionsTable.status, ["active", "paused"]),
        ),
      );
    activeDcmsSubscriptionsCount = subCountRow?.count ?? 0;
  } catch (err) {
    logger.warn({ err, cityId }, "Failed to query DCMS subscriptions for city dashboard");
  }

  // Today's jobs
  const todayStr = new Date().toISOString().slice(0, 10);
  let todayJobsScheduled = 0;
  let todayJobsCompleted = 0;
  if (branchIds.length > 0) {
    const todayBookings = await db
      .select({ id: bookingsTable.id, status: bookingsTable.status })
      .from(bookingsTable)
      .where(and(inArray(bookingsTable.branchId, branchIds), eq(bookingsTable.scheduledDate, todayStr)));
    todayJobsScheduled = todayBookings.length;
    todayJobsCompleted = todayBookings.filter((b) => b.status === "confirmed").length;
  }
  const todayCompletionRate =
    todayJobsScheduled > 0 ? Math.round((todayJobsCompleted / todayJobsScheduled) * 100) : 100;

  // Monthly revenue from invoices
  let monthlyCollections = 0;
  if (branchIds.length > 0) {
    const [revRow] = await db
      .select({ total: sql<string>`coalesce(sum(paid_amount), 0)` })
      .from(invoicesTable)
      .where(
        and(
          inArray(invoicesTable.branchId, branchIds),
          sql`created_at >= date_trunc('month', current_date)`,
        ),
      );
    monthlyCollections = parseFloat(revRow?.total || "0");
  }

  return {
    cityId: city.id,
    cityName: city.name,
    cityCode: city.code,
    status: city.status,
    activeBranchesCount: activeBranches.length,
    totalBranchesCount: allBranches.length,
    activeStaffCount,
    activeSupervisorsCount,
    activeCustomersCount,
    activeDcmsSubscriptionsCount,
    todayJobsScheduled,
    todayJobsCompleted,
    todayCompletionRate,
    monthlyCollections,
  };
}

/**
 * Returns dynamic, configuration-driven customer app & marketing content for a city (PRD v4.0, CITY-005)
 */
export async function getCityContent(cityIdOrSlug: string | number): Promise<Record<string, unknown>> {
  let city: City | undefined;
  if (typeof cityIdOrSlug === "number" || /^\d+$/.test(cityIdOrSlug.toString())) {
    const [c] = await db.select().from(citiesTable).where(eq(citiesTable.id, Number(cityIdOrSlug))).limit(1);
    city = c;
  } else {
    const [c] = await db.select().from(citiesTable).where(eq(citiesTable.slug, cityIdOrSlug.toLowerCase())).limit(1);
    city = c;
  }

  if (!city) {
    throw new Error(`City "${cityIdOrSlug}" not found`);
  }

  const customContent = (city.contentSettings || {}) as Record<string, unknown>;

  // Merge custom city content with intelligent dynamic defaults
  return {
    cityId: city.id,
    cityName: city.name,
    citySlug: city.slug,
    cityCode: city.code,
    status: city.status,
    heroBadge: customContent.heroBadge || `${city.name}'s #1 Doorstep Detailing & Auto Care`,
    heroHeadline: customContent.heroHeadline || "Showroom Shine at Your Doorstep, Every Single Morning.",
    heroSubtitle:
      customContent.heroSubtitle ||
      `Professional doorstep car care and detailing in ${city.name}. We bring certified technicians, 100% RO water, and premium microfiber care right to your parking bay.`,
    highlights: customContent.highlights || [
      "Zero Scratches",
      "100% RO Water",
      "Korean Microfibers",
      "Certified Techs",
    ],
    contactPhone: city.contactPhone || "9999999999",
    contactEmail: city.contactEmail || "support@cwpdetailers.com",
    seoTitle: customContent.seoTitle || `Doorstep Car Detailing & Cleaning in ${city.name} | CWP Detailers`,
    seoDescription:
      customContent.seoDescription ||
      `Best doorstep car detailing, daily wash subscription, and solar panel cleaning services in ${city.name}. Book online with CWP Detailers.`,
    ...customContent,
  };
}
