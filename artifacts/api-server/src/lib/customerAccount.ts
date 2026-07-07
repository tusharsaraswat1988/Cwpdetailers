import { db, customersTable, usersTable, type User } from "@workspace/db";
import { and, sql, eq } from "drizzle-orm";
import type { Request } from "express";
import { tenantFilters } from "../middlewares/tenantScope";
import { hashPassword } from "./passwords";
import { assertContactIdentityAvailable } from "./contactIdentity";
import { authProviderAfterPasswordSet } from "./userPassword";

const PHONE_MATCH = (phone: string) =>
  sql`RIGHT(REGEXP_REPLACE(${customersTable.phone}, '[^0-9]', '', 'g'), 10) = ${phone}`;

const EMAIL_MATCH = (email: string) =>
  sql`LOWER(TRIM(${customersTable.email})) = ${email}`;

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

export async function findCustomerByPhone(phone: string) {
  const normalized = phone.replace(/\D/g, "").slice(-10);
  if (normalized.length < 10) return null;

  const [customer] = await db
    .select()
    .from(customersTable)
    .where(PHONE_MATCH(normalized))
    .limit(1);

  return customer ?? null;
}

export async function findCustomerByEmail(email: string) {
  const normalized = email.toLowerCase().trim();
  if (!normalized) return null;

  const [customer] = await db
    .select()
    .from(customersTable)
    .where(
      and(
        sql`${customersTable.email} IS NOT NULL`,
        sql`TRIM(${customersTable.email}) <> ''`,
        EMAIL_MATCH(normalized),
      ),
    )
    .limit(1);

  return customer ?? null;
}

export type EnsureCustomerLoginOptions = {
  googleId?: string;
  email?: string | null;
  avatarUrl?: string | null;
  authProvider?: string;
  passwordHash?: string | null;
};

/** Create or repair a login user for an existing customer (handles stale customer.userId). */
export async function ensureCustomerLoginUser(
  customer: typeof customersTable.$inferSelect,
  options: EnsureCustomerLoginOptions = {},
): Promise<User> {
  if (customer.status !== "active") {
    throw new Error("This customer account is not active. Contact support.");
  }

  const normalizedEmail =
    options.email?.toLowerCase().trim() ?? customer.email?.toLowerCase().trim() ?? null;

  if (customer.userId) {
    const [linked] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, customer.userId))
      .limit(1);

    if (linked) {
      if (linked.role !== "customer") {
        throw new Error("This mobile number is registered to a different account type.");
      }
      if (!linked.isActive) throw new Error("Account suspended");
      if (options.googleId && linked.googleId && linked.googleId !== options.googleId) {
        throw new Error("This account is already linked to a different Google account.");
      }

      const updates: Partial<typeof usersTable.$inferInsert> = {
        customerId: linked.customerId ?? customer.id,
        updatedAt: new Date(),
      };
      if (options.googleId) updates.googleId = options.googleId;
      if (options.avatarUrl) updates.avatarUrl = options.avatarUrl;
      if (normalizedEmail && !linked.email) updates.email = normalizedEmail;
      if (options.passwordHash) {
        updates.passwordHash = options.passwordHash;
        updates.authProvider = authProviderAfterPasswordSet({
          ...linked,
          googleId: options.googleId ?? linked.googleId,
        });
      } else if (options.googleId) {
        updates.authProvider = authProviderAfterPasswordSet({
          ...linked,
          googleId: options.googleId,
        });
      } else if (options.authProvider) {
        updates.authProvider = options.authProvider;
      }

      if (Object.keys(updates).length > 1) {
        const [updated] = await db
          .update(usersTable)
          .set(updates)
          .where(eq(usersTable.id, linked.id))
          .returning();
        return updated ?? linked;
      }

      return linked;
    }
  }

  const [phoneUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.phone, customer.phone))
    .limit(1);

  if (phoneUser) {
    if (phoneUser.role !== "customer" || !phoneUser.isActive) {
      throw new Error("This mobile number is registered to a different account type.");
    }

    await db
      .update(customersTable)
      .set({ userId: phoneUser.id, updatedAt: new Date() })
      .where(eq(customersTable.id, customer.id));
    await db
      .update(usersTable)
      .set({ customerId: customer.id, updatedAt: new Date() })
      .where(eq(usersTable.id, phoneUser.id));

    return phoneUser;
  }

  const [user] = await db
    .insert(usersTable)
    .values({
      name: customer.name,
      phone: customer.phone,
      email: normalizedEmail ?? undefined,
      passwordHash: options.passwordHash ?? null,
      role: "customer",
      googleId: options.googleId,
      avatarUrl: options.avatarUrl,
      authProvider: options.authProvider ?? "local",
      customerId: customer.id,
      branchId: customer.branchId,
      companyId: customer.companyId ?? undefined,
      franchiseeId: customer.franchiseeId ?? undefined,
      isActive: true,
    })
    .returning();

  if (!user) throw new Error("Failed to create login account");

  await db
    .update(customersTable)
    .set({
      userId: user.id,
      email: customer.email?.trim() ? customer.email : normalizedEmail,
      updatedAt: new Date(),
    })
    .where(eq(customersTable.id, customer.id));

  return user;
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
