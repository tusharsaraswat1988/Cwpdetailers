import { db, staffTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

type StaffRow = typeof staffTable.$inferSelect;

async function findStaffLoginUser(staff: StaffRow) {
  if (staff.userId) {
    const [byId] = await db.select().from(usersTable).where(eq(usersTable.id, staff.userId)).limit(1);
    if (byId) return byId;
  }
  const [byStaffId] = await db.select().from(usersTable).where(eq(usersTable.staffId, staff.id)).limit(1);
  if (byStaffId) return byStaffId;
  const [byPhone] = await db.select().from(usersTable).where(eq(usersTable.phone, staff.phone)).limit(1);
  return byPhone ?? null;
}

/** Keep portal login (users row) in sync when admin edits staff profile. */
export async function syncStaffLoginUser(staff: StaffRow): Promise<void> {
  const loginUser = await findStaffLoginUser(staff);
  if (!loginUser) return;

  await db.update(usersTable).set({
    name: staff.name,
    phone: staff.phone,
    email: staff.email,
    branchId: staff.branchId,
    companyId: staff.companyId,
    franchiseeId: staff.franchiseeId,
    staffId: staff.id,
    updatedAt: new Date(),
  }).where(eq(usersTable.id, loginUser.id));

  if (staff.userId !== loginUser.id) {
    await db.update(staffTable).set({
      userId: loginUser.id,
      updatedAt: new Date(),
    }).where(eq(staffTable.id, staff.id));
  }
}
