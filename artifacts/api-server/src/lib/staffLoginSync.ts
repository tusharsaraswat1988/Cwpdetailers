import { db, staffTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "./passwords";
import { authProviderForStaffPassword } from "./userPassword";

type StaffRow = typeof staffTable.$inferSelect;

export async function findStaffLoginUser(staff: StaffRow) {
  if (staff.userId) {
    const [byId] = await db.select().from(usersTable).where(eq(usersTable.id, staff.userId)).limit(1);
    if (byId) return byId;
  }
  const [byStaffId] = await db.select().from(usersTable).where(eq(usersTable.staffId, staff.id)).limit(1);
  if (byStaffId) return byStaffId;
  const [byPhone] = await db.select().from(usersTable).where(eq(usersTable.phone, staff.phone)).limit(1);
  return byPhone ?? null;
}

/** Set or repair staff portal credentials (phone + admin password). */
export async function setStaffPortalPassword(
  staff: StaffRow,
  password: string,
): Promise<{ userId: number; phone: string; repaired: boolean }> {
  if (!password || String(password).length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const passwordHash = await hashPassword(password);
  const existing = await findStaffLoginUser(staff);

  if (existing) {
    const [updated] = await db
      .update(usersTable)
      .set({
        name: staff.name,
        phone: staff.phone,
        email: staff.email ?? existing.email,
        passwordHash,
        authProvider: authProviderForStaffPassword(),
        role: "staff",
        staffId: staff.id,
        branchId: staff.branchId,
        companyId: staff.companyId ?? undefined,
        franchiseeId: staff.franchiseeId ?? undefined,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, existing.id))
      .returning();

    if (!updated) throw new Error("Failed to update staff login account");

    await db
      .update(staffTable)
      .set({
        userId: updated.id,
        verificationStatus: staff.verificationStatus === "pending" ? "verified" : staff.verificationStatus,
        verifiedAt: staff.verifiedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(staffTable.id, staff.id));

    return { userId: updated.id, phone: updated.phone, repaired: true };
  }

  const [user] = await db
    .insert(usersTable)
    .values({
      name: staff.name,
      phone: staff.phone,
      email: staff.email ?? undefined,
      passwordHash,
      role: "staff",
      authProvider: authProviderForStaffPassword(),
      branchId: staff.branchId,
      companyId: staff.companyId ?? undefined,
      franchiseeId: staff.franchiseeId ?? undefined,
      staffId: staff.id,
      isActive: true,
    })
    .returning();

  if (!user) throw new Error("Failed to create staff login account");

  await db
    .update(staffTable)
    .set({
      userId: user.id,
      verificationStatus: staff.verificationStatus === "pending" ? "verified" : staff.verificationStatus,
      verifiedAt: staff.verifiedAt ?? new Date(),
      updatedAt: new Date(),
    })
    .where(eq(staffTable.id, staff.id));

  return { userId: user.id, phone: user.phone, repaired: false };
}

/** After a successful staff password login, keep auth metadata aligned with phone/password auth. */
export async function normalizeStaffPasswordLogin(userId: number): Promise<void> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user || user.role !== "staff") return;
  if (user.authProvider === authProviderForStaffPassword()) return;

  await db
    .update(usersTable)
    .set({ authProvider: authProviderForStaffPassword(), updatedAt: new Date() })
    .where(eq(usersTable.id, userId));
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
