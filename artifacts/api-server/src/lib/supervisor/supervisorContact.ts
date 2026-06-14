import { db, staffTable, vehiclesTable, customersTable, bookingsTable } from "@workspace/db";
import { eq, and, desc, isNotNull } from "drizzle-orm";

export type SupervisorContact = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  employeeCode: string | null;
};

const supervisorSelect = {
  id: staffTable.id,
  name: staffTable.name,
  phone: staffTable.phone,
  email: staffTable.email,
  employeeCode: staffTable.employeeCode,
};

async function loadSupervisorById(id: number): Promise<SupervisorContact | null> {
  const [row] = await db
    .select(supervisorSelect)
    .from(staffTable)
    .where(and(
      eq(staffTable.id, id),
      eq(staffTable.staffCategory, "supervisor"),
      eq(staffTable.isActive, true),
    ))
    .limit(1);
  return row ?? null;
}

export async function resolveSupervisorForStaff(staffId: number): Promise<SupervisorContact | null> {
  const [staff] = await db
    .select({ reportingManagerId: staffTable.reportingManagerId })
    .from(staffTable)
    .where(eq(staffTable.id, staffId))
    .limit(1);
  if (!staff?.reportingManagerId) return null;
  return loadSupervisorById(staff.reportingManagerId);
}

export async function resolveSupervisorForBranch(branchId: number): Promise<SupervisorContact | null> {
  const [row] = await db
    .select(supervisorSelect)
    .from(staffTable)
    .where(and(
      eq(staffTable.branchId, branchId),
      eq(staffTable.staffCategory, "supervisor"),
      eq(staffTable.isActive, true),
    ))
    .limit(1);
  return row ?? null;
}

export async function resolveSupervisorForCustomer(customerId: number): Promise<SupervisorContact | null> {
  const [vehicle] = await db
    .select({ assignedStaffId: vehiclesTable.assignedStaffId })
    .from(vehiclesTable)
    .where(and(eq(vehiclesTable.customerId, customerId), isNotNull(vehiclesTable.assignedStaffId)))
    .orderBy(desc(vehiclesTable.updatedAt))
    .limit(1);

  if (vehicle?.assignedStaffId) {
    const supervisor = await resolveSupervisorForStaff(vehicle.assignedStaffId);
    if (supervisor) return supervisor;
  }

  const [customer] = await db
    .select({ branchId: customersTable.branchId })
    .from(customersTable)
    .where(eq(customersTable.id, customerId))
    .limit(1);

  if (customer?.branchId) {
    return resolveSupervisorForBranch(customer.branchId);
  }

  return null;
}

export async function resolveSupervisorForBooking(bookingId: number): Promise<{
  relatedStaffId: number | null;
  supervisor: SupervisorContact | null;
}> {
  const [booking] = await db
    .select({ staffId: bookingsTable.staffId, customerId: bookingsTable.customerId })
    .from(bookingsTable)
    .where(eq(bookingsTable.id, bookingId))
    .limit(1);

  if (!booking) return { relatedStaffId: null, supervisor: null };

  if (booking.staffId) {
    const supervisor = await resolveSupervisorForStaff(booking.staffId);
    if (supervisor) return { relatedStaffId: booking.staffId, supervisor };
  }

  const supervisor = await resolveSupervisorForCustomer(booking.customerId);
  return { relatedStaffId: booking.staffId ?? null, supervisor };
}

export async function listDirectReports(supervisorId: number) {
  return db
    .select({
      id: staffTable.id,
      name: staffTable.name,
      phone: staffTable.phone,
      employeeCode: staffTable.employeeCode,
      isActive: staffTable.isActive,
    })
    .from(staffTable)
    .where(and(
      eq(staffTable.reportingManagerId, supervisorId),
      eq(staffTable.staffCategory, "cleaning_staff"),
    ))
    .orderBy(staffTable.name);
}
