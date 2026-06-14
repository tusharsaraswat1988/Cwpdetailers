import { db, staffTable, staffRoleMasterTable, staffRoleAssignmentsTable, type Staff } from "@workspace/db";
import { eq, and, inArray, asc } from "drizzle-orm";
import { staffAssignableError } from "./profileCompletion";

/** Operational role slugs — must match `staff_role_master.slug` seed in 007_staff_ecosystem.sql */
export const OPERATIONAL_ROLE_SLUGS = {
  DAILY_CAR_CLEANER: "daily_car_cleaner",
  CAR_WASHER: "car_washer",
  SOLAR_CLEANER: "solar_cleaner",
  INTERIOR_DETAILER: "interior_detailer",
  COATING_DETAILER: "coating_detailer",
} as const;

export type OperationalRoleSlug = (typeof OPERATIONAL_ROLE_SLUGS)[keyof typeof OPERATIONAL_ROLE_SLUGS];

/** Booking service types → required operational role (STAFF_ECOSYSTEM + booking domain). */
export const BOOKING_SERVICE_ROLE_MAP: Record<string, OperationalRoleSlug> = {
  car_wash: OPERATIONAL_ROLE_SLUGS.CAR_WASHER,
  one_time_wash: OPERATIONAL_ROLE_SLUGS.CAR_WASHER,
  subscription_wash: OPERATIONAL_ROLE_SLUGS.CAR_WASHER,
  pickup_drop: OPERATIONAL_ROLE_SLUGS.CAR_WASHER,
  emergency: OPERATIONAL_ROLE_SLUGS.CAR_WASHER,
  daily_cleaning: OPERATIONAL_ROLE_SLUGS.DAILY_CAR_CLEANER,
  solar_cleaning: OPERATIONAL_ROLE_SLUGS.SOLAR_CLEANER,
  detailing: OPERATIONAL_ROLE_SLUGS.INTERIOR_DETAILER,
};

export function roleSlugForBookingService(serviceType: string): OperationalRoleSlug | null {
  return BOOKING_SERVICE_ROLE_MAP[serviceType] ?? null;
}

export function roleSlugForVehicleAssignment(): OperationalRoleSlug {
  return OPERATIONAL_ROLE_SLUGS.DAILY_CAR_CLEANER;
}

/** Map operational slug → legacy `staff.role` enum for backward-compatible column writes. */
export function operationalSlugToLegacyRole(
  slug: string,
): "technician" | "supervisor" | "driver" | "solar_technician" {
  if (slug === OPERATIONAL_ROLE_SLUGS.SOLAR_CLEANER) return "solar_technician";
  return "technician";
}

export async function staffHasOperationalRole(staffId: number, roleSlug: string): Promise<boolean> {
  const [row] = await db
    .select({ id: staffRoleAssignmentsTable.id })
    .from(staffRoleAssignmentsTable)
    .innerJoin(staffRoleMasterTable, eq(staffRoleAssignmentsTable.roleId, staffRoleMasterTable.id))
    .where(and(
      eq(staffRoleAssignmentsTable.staffId, staffId),
      eq(staffRoleMasterTable.slug, roleSlug),
      eq(staffRoleMasterTable.isActive, true),
    ))
    .limit(1);
  return Boolean(row);
}

export async function staffOperationalRoleError(
  staff: Pick<Staff, "id" | "isActive" | "verificationStatus">,
  roleSlug: string,
): Promise<string | null> {
  const baseErr = staffAssignableError(staff);
  if (baseErr) return baseErr;
  const hasRole = await staffHasOperationalRole(staff.id, roleSlug);
  if (!hasRole) {
    const [role] = await db
      .select({ name: staffRoleMasterTable.name })
      .from(staffRoleMasterTable)
      .where(eq(staffRoleMasterTable.slug, roleSlug))
      .limit(1);
    const label = role?.name ?? roleSlug.replace(/_/g, " ");
    return `Staff member does not have the "${label}" operational role required for this assignment`;
  }
  return null;
}

export async function getStaffIdsWithOperationalRole(roleSlug: string): Promise<number[]> {
  const rows = await db
    .select({ staffId: staffRoleAssignmentsTable.staffId })
    .from(staffRoleAssignmentsTable)
    .innerJoin(staffRoleMasterTable, eq(staffRoleAssignmentsTable.roleId, staffRoleMasterTable.id))
    .where(and(
      eq(staffRoleMasterTable.slug, roleSlug),
      eq(staffRoleMasterTable.isActive, true),
    ));
  return [...new Set(rows.map(r => r.staffId))];
}

export type StaffOperationalRole = {
  roleId: number;
  roleName: string;
  roleSlug: string;
  skillLevel: string;
};

export async function getStaffOperationalRoles(staffId: number): Promise<StaffOperationalRole[]> {
  return db
    .select({
      roleId: staffRoleAssignmentsTable.roleId,
      roleName: staffRoleMasterTable.name,
      roleSlug: staffRoleMasterTable.slug,
      skillLevel: staffRoleAssignmentsTable.skillLevel,
    })
    .from(staffRoleAssignmentsTable)
    .innerJoin(staffRoleMasterTable, eq(staffRoleAssignmentsTable.roleId, staffRoleMasterTable.id))
    .where(and(eq(staffRoleAssignmentsTable.staffId, staffId), eq(staffRoleMasterTable.isActive, true)))
    .orderBy(asc(staffRoleMasterTable.sortOrder));
}

export async function attachOperationalRoles<T extends { id: number }>(
  staffRows: T[],
): Promise<(T & { operationalRoles: StaffOperationalRole[] })[]> {
  if (staffRows.length === 0) return [];
  const ids = staffRows.map(s => s.id);
  const assignments = await db
    .select({
      staffId: staffRoleAssignmentsTable.staffId,
      roleId: staffRoleAssignmentsTable.roleId,
      roleName: staffRoleMasterTable.name,
      roleSlug: staffRoleMasterTable.slug,
      skillLevel: staffRoleAssignmentsTable.skillLevel,
    })
    .from(staffRoleAssignmentsTable)
    .innerJoin(staffRoleMasterTable, eq(staffRoleAssignmentsTable.roleId, staffRoleMasterTable.id))
    .where(and(inArray(staffRoleAssignmentsTable.staffId, ids), eq(staffRoleMasterTable.isActive, true)))
    .orderBy(asc(staffRoleMasterTable.sortOrder));

  const byStaff = new Map<number, StaffOperationalRole[]>();
  for (const row of assignments) {
    const list = byStaff.get(row.staffId) ?? [];
    list.push({
      roleId: row.roleId,
      roleName: row.roleName,
      roleSlug: row.roleSlug,
      skillLevel: row.skillLevel,
    });
    byStaff.set(row.staffId, list);
  }

  return staffRows.map(s => ({
    ...s,
    operationalRoles: byStaff.get(s.id) ?? [],
  }));
}

export async function assignOperationalRoles(
  staffId: number,
  roleIds: number[],
  skillLevel: "trainee" | "basic" | "intermediate" | "expert" = "basic",
): Promise<void> {
  if (roleIds.length === 0) return;
  const unique = [...new Set(roleIds)];
  await db.insert(staffRoleAssignmentsTable).values(
    unique.map(roleId => ({ staffId, roleId, skillLevel })),
  ).onConflictDoNothing({ target: [staffRoleAssignmentsTable.staffId, staffRoleAssignmentsTable.roleId] });
}
