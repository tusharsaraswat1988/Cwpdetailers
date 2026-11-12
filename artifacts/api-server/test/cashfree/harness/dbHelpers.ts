import crypto from "node:crypto";
import { loadRepoEnv } from "../../../../../lib/env/load-env.mjs";

// Ensure repo root .env is loaded before importing @workspace/db
loadRepoEnv(import.meta.url);

import {
  db,
  usersTable,
  customersTable,
  sessionsTable,
  invoicesTable,
  paymentsTable,
  paymentAttemptsTable,
  type PaymentAttempt,
  type Invoice,
  type Customer,
  type Payment,
} from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { hashToken } from "../../../src/middlewares/auth";
import { syncCustomerTotalDues } from "../../../src/lib/billing/invoiceService";

export interface TestCustomerFixture {
  customerId: number;
  userId: number;
  token: string;
  authHeaders: Record<string, string>;
  invoiceId: number;
  invoiceNumber: string;
  balanceDue: number;
}

export interface TestAdminFixture {
  userId: number;
  token: string;
  authHeaders: Record<string, string>;
}

export async function createAdminFixture(): Promise<TestAdminFixture> {
  const unique = Math.floor(100000 + Math.random() * 900000);
  const [user] = await db
    .insert(usersTable)
    .values({
      name: `Admin Test ${unique}`,
      phone: `+9199${unique}00`,
      role: "superadmin",
      isActive: true,
    })
    .returning();

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  await db.insert(sessionsTable).values({
    userId: user.id,
    tokenHash,
    expiresAt: new Date(Date.now() + 86400000),
  });

  return {
    userId: user.id,
    token: rawToken,
    authHeaders: {
      Authorization: `Bearer ${rawToken}`,
      "X-Auth-Portal": "admin",
    },
  };
}

export async function cleanupAdminFixture(fixture: TestAdminFixture): Promise<void> {
  try {
    await db.delete(sessionsTable).where(eq(sessionsTable.userId, fixture.userId));
    await db.delete(usersTable).where(eq(usersTable.id, fixture.userId));
  } catch (err) {
    console.warn("Admin fixture cleanup warning:", err);
  }
}

/**
 * Creates an isolated test customer fixture with an active session token
 * and an open tax invoice for end-to-end payment testing.
 */
export async function createTestCustomerFixture(opts: {
  name?: string;
  phone?: string;
  balanceDue?: number;
} = {}): Promise<TestCustomerFixture> {
  const uniqueSuffix = Math.floor(100000 + Math.random() * 900000);
  const name = opts.name || `Cashfree Test Customer ${uniqueSuffix}`;
  const phone = opts.phone || `+9198${uniqueSuffix}12`;
  const balance = opts.balanceDue ?? 1300.0;

  // 1. Create customer
  const [customer] = await db
    .insert(customersTable)
    .values({
      name,
      phone,
      totalDues: balance.toFixed(2),
    })
    .returning();

  // 2. Create customer user account
  const [user] = await db
    .insert(usersTable)
    .values({
      name,
      phone,
      role: "customer",
      customerId: customer.id,
      isActive: true,
    })
    .returning();

  await db.update(customersTable).set({ userId: user.id }).where(eq(customersTable.id, customer.id));

  // 3. Create active session
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  await db.insert(sessionsTable).values({
    userId: user.id,
    tokenHash,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  // 4. Create open tax invoice
  const invNumber = `INV-CF-${uniqueSuffix}`;
  const [invoice] = await db
    .insert(invoicesTable)
    .values({
      customerId: customer.id,
      invoiceNumber: invNumber,
      totalAmount: balance.toFixed(2),
      balanceDue: balance.toFixed(2),
      paidAmount: "0.00",
      status: "sent",
      documentType: "tax_invoice",
      commercialStatus: "issued",
      items: [
        {
          description: "Full Car Detailing Package",
          quantity: 1,
          unitPrice: balance,
          total: balance,
          sacCode: "9987",
        },
      ],
    })
    .returning();

  await syncCustomerTotalDues(customer.id);

  return {
    customerId: customer.id,
    userId: user.id,
    token: rawToken,
    authHeaders: {
      Authorization: `Bearer ${rawToken}`,
      "X-Auth-Portal": "customer",
    },
    invoiceId: invoice.id,
    invoiceNumber: invNumber,
    balanceDue: balance,
  };
}

/**
 * Creates an additional open invoice for an existing customer
 */
export async function createAdditionalInvoice(
  customerId: number,
  amount: number,
  status: "sent" | "overdue" | "draft" = "sent"
): Promise<{ invoiceId: number; invoiceNumber: string; balanceDue: number }> {
  const uniqueSuffix = Math.floor(100000 + Math.random() * 900000);
  const invNumber = `INV-CF-${uniqueSuffix}`;
  const [invoice] = await db
    .insert(invoicesTable)
    .values({
      customerId,
      invoiceNumber: invNumber,
      totalAmount: amount.toFixed(2),
      balanceDue: amount.toFixed(2),
      paidAmount: "0.00",
      status,
      documentType: "tax_invoice",
      commercialStatus: "issued",
      items: [
        {
          description: "Maintenance Package",
          quantity: 1,
          unitPrice: amount,
          total: amount,
          sacCode: "9987",
        },
      ],
    })
    .returning();

  await syncCustomerTotalDues(customerId);

  return {
    invoiceId: invoice.id,
    invoiceNumber: invNumber,
    balanceDue: amount,
  };
}

/**
 * Emergency cleanup for any zombie/orphaned Cashfree test fixtures
 * from failed runs or crashes.
 */
export async function emergencyCleanupOrphanFixtures(): Promise<void> {
  try {
    const orphanCustomers = await db
      .select({ id: customersTable.id, userId: customersTable.userId })
      .from(customersTable)
      .where(sql`${customersTable.name} LIKE '%Cashfree%'`);

    for (const c of orphanCustomers) {
      await db.delete(paymentAttemptsTable).where(eq(paymentAttemptsTable.customerId, c.id));
      await db.delete(paymentsTable).where(eq(paymentsTable.customerId, c.id));
      await db.delete(invoicesTable).where(eq(invoicesTable.customerId, c.id));
      if (c.userId) {
        await db.delete(sessionsTable).where(eq(sessionsTable.userId, c.userId));
        await db.delete(usersTable).where(eq(usersTable.id, c.userId));
      }
      await db.delete(customersTable).where(eq(customersTable.id, c.id));
    }

    const orphanInvoices = await db
      .select({ id: invoicesTable.id, customerId: invoicesTable.customerId })
      .from(invoicesTable)
      .where(sql`${invoicesTable.invoiceNumber} LIKE '%INV-CF%'`);

    for (const inv of orphanInvoices) {
      await db.delete(paymentsTable).where(eq(paymentsTable.invoiceId, inv.id));
      await db.delete(paymentAttemptsTable).where(eq(paymentAttemptsTable.invoiceId, inv.id));
      await db.delete(invoicesTable).where(eq(invoicesTable.id, inv.id));
      if (inv.customerId) {
        await db.delete(customersTable).where(eq(customersTable.id, inv.customerId));
      }
    }

    const orphanAdmins = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(sql`${usersTable.name} LIKE 'Admin Test %'`);

    for (const adm of orphanAdmins) {
      await db.delete(sessionsTable).where(eq(sessionsTable.userId, adm.id));
      await db.delete(usersTable).where(eq(usersTable.id, adm.id));
    }
  } catch (err) {
    console.warn("Emergency cleanup warning:", err);
  }
}

/**
 * Clean up customer fixture and all associated records
 */
export async function cleanupCustomerFixture(fixture: {
  customerId: number;
  userId?: number;
}): Promise<void> {
  try {
    await db.delete(paymentAttemptsTable).where(eq(paymentAttemptsTable.customerId, fixture.customerId));
    await db.delete(paymentsTable).where(eq(paymentsTable.customerId, fixture.customerId));
    await db.delete(invoicesTable).where(eq(invoicesTable.customerId, fixture.customerId));
    if (fixture.userId) {
      await db.delete(sessionsTable).where(eq(sessionsTable.userId, fixture.userId));
      await db.delete(usersTable).where(eq(usersTable.id, fixture.userId));
    } else {
      const [c] = await db
        .select({ userId: customersTable.userId })
        .from(customersTable)
        .where(eq(customersTable.id, fixture.customerId))
        .limit(1);
      if (c?.userId) {
        await db.delete(sessionsTable).where(eq(sessionsTable.userId, c.userId));
        await db.delete(usersTable).where(eq(usersTable.id, c.userId));
      }
    }
    await db.delete(customersTable).where(eq(customersTable.id, fixture.customerId));
  } catch (err) {
    // Suppress cleanup error to not mask test errors
    console.warn("Fixture cleanup warning:", err);
  }
}

/**
 * Direct query helpers for assertions
 */
export async function getInvoice(id: number): Promise<Invoice | undefined> {
  const [row] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id)).limit(1);
  return row;
}

export async function getCustomer(id: number): Promise<Customer | undefined> {
  const [row] = await db.select().from(customersTable).where(eq(customersTable.id, id)).limit(1);
  return row;
}

export async function getPaymentAttempts(customerId: number): Promise<PaymentAttempt[]> {
  return db
    .select()
    .from(paymentAttemptsTable)
    .where(eq(paymentAttemptsTable.customerId, customerId))
    .orderBy(desc(paymentAttemptsTable.createdAt));
}

export async function getPaymentAttemptByOrderId(cfOrderId: string): Promise<PaymentAttempt | undefined> {
  const [row] = await db
    .select()
    .from(paymentAttemptsTable)
    .where(eq(paymentAttemptsTable.cfOrderId, cfOrderId))
    .limit(1);
  return row;
}

export async function getPayments(customerId: number): Promise<Payment[]> {
  return db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.customerId, customerId))
    .orderBy(desc(paymentsTable.createdAt));
}

export async function getPaymentsByInvoiceId(invoiceId: number): Promise<Payment[]> {
  return db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.invoiceId, invoiceId))
    .orderBy(desc(paymentsTable.createdAt));
}
