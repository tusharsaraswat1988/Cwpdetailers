import { db, customersTable, usersTable } from "@workspace/db";
import { and, sql, eq } from "drizzle-orm";
import type { Request } from "express";
import { tenantFilters } from "../middlewares/tenantScope";
import { hashPassword } from "./passwords";
import { assertContactIdentityAvailable } from "./contactIdentity";

const SCOPE_COLS = {
  companyCol: customersTable.companyId,
  branchCol: customersTable.branchId,
  franchiseeCol: customersTable.franchiseeId,
  customerCol: customersTable.id,
};

export async function findCustomerByPhoneInScope(req: Request, phone: string) {
  const normalized = phone.replace(/\D/g, "").slice(-10);
  if (normalized.length < 10) return null;

  const conditions = [
    ...tenantFilters(req, SCOPE_COLS),
    sql`RIGHT(REGEXP_REPLACE(${customersTable.phone}, '[^0-9]', '', 'g'), 10) = ${normalized}`,
  ];

  const [customer] = await db
    .select({
      id: customersTable.id,
      name: customersTable.name,
      phone: customersTable.phone,
      userId: customersTable.userId,
    })
    .from(customersTable)
    .where(and(...conditions))
    .limit(1);

  return customer ?? null;
}

export async function createCustomerLoginAccount(
  customer: typeof customersTable.$inferSelect,
  password: string,
) {
  if (!password || String(password).length < 6) {
    throw new Error("Password must be at least 6 characters");
  }
  if (customer.userId) {
    throw new Error("Login account already exists for this customer");
  }

  const identityCheck = await assertContactIdentityAvailable(
    customer.phone,
    customer.email,
    { entity: "customer", id: customer.id },
  );
  if (!identityCheck.ok) {
    throw new Error(identityCheck.body.error as string);
  }

  const [existingUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.phone, customer.phone))
    .limit(1);
  if (existingUser) {
    throw new Error("A login account with this phone number already exists");
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(usersTable)
    .values({
      name: customer.name,
      phone: customer.phone,
      email: customer.email ?? undefined,
      passwordHash,
      role: "customer",
      branchId: customer.branchId,
      companyId: customer.companyId ?? undefined,
      franchiseeId: customer.franchiseeId ?? undefined,
      customerId: customer.id,
      isActive: true,
    })
    .returning();

  await db
    .update(customersTable)
    .set({ userId: user.id, updatedAt: new Date() })
    .where(eq(customersTable.id, customer.id));

  return { userId: user.id, phone: user.phone };
}

/** Keep login user row in sync when a customer updates their own profile. */
export async function syncCustomerLoginProfile(
  customerId: number,
  fields: { name?: string; phone?: string; email?: string | null },
) {
  const [customer] = await db
    .select({ userId: customersTable.userId })
    .from(customersTable)
    .where(eq(customersTable.id, customerId))
    .limit(1);

  if (!customer?.userId) return;

  const userUpdate: Record<string, unknown> = { updatedAt: new Date() };
  if (fields.name !== undefined) userUpdate.name = fields.name;
  if (fields.phone !== undefined) userUpdate.phone = fields.phone;
  if (fields.email !== undefined) userUpdate.email = fields.email ?? null;

  await db.update(usersTable).set(userUpdate).where(eq(usersTable.id, customer.userId));
}
