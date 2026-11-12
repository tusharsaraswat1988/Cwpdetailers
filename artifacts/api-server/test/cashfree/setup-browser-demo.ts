import "./harness/loadEnv";
import crypto from "crypto";
import { db, usersTable, customersTable, invoicesTable, sessionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { hashPassword } from "../../src/lib/passwords";
import { hashToken } from "../../src/middlewares/auth";

export async function setupBrowserDemo() {
  const phone = "9999999901";
  const rawPhone = "+919999999901";

  // 1. Find or create customer
  let customer = await db.query.customersTable.findFirst({
    where: eq(customersTable.phone, rawPhone),
  });

  if (!customer) {
    const [c] = await db
      .insert(customersTable)
      .values({
        name: "Tushar Customer",
        phone: rawPhone,
        totalDues: "1300.00",
        email: "tushar@cwpdetailers.com",
        address: "B75, Gurudham Colony Lane No. 5, Durgakund Road, Bhelupur, Varanasi - 221005",
      })
      .returning();
    customer = c;
  } else {
    await db.update(customersTable).set({ totalDues: "1300.00" }).where(eq(customersTable.id, customer.id));
  }

  // 2. Find or create user
  let user = await db.query.usersTable.findFirst({
    where: eq(usersTable.phone, phone),
  });

  const pwdHash = await hashPassword("customer123");

  if (!user) {
    const [u] = await db
      .insert(usersTable)
      .values({
        name: "Tushar Customer",
        phone,
        passwordHash: pwdHash,
        role: "customer",
        portal: "customer",
        customerId: customer.id,
        isActive: true,
      })
      .returning();
    user = u;
  } else {
    await db
      .update(usersTable)
      .set({
        passwordHash: pwdHash,
        customerId: customer.id,
        role: "customer",
        portal: "customer",
        isActive: true,
      })
      .where(eq(usersTable.id, user.id));
  }

  await db.update(customersTable).set({ userId: user.id }).where(eq(customersTable.id, customer.id));

  // 3. Create persistent session token
  const rawToken = "demo_cashfree_session_token_" + crypto.randomBytes(16).toString("hex");
  const tokenHash = hashToken(rawToken);
  await db.insert(sessionsTable).values({
    userId: user.id,
    tokenHash,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  // 4. Ensure open tax invoice of 1300
  let invoice = await db.query.invoicesTable.findFirst({
    where: eq(invoicesTable.customerId, customer.id),
    orderBy: [desc(invoicesTable.id)],
  });

  if (!invoice) {
    const [inv] = await db
      .insert(invoicesTable)
      .values({
        customerId: customer.id,
        invoiceNumber: "INV-2026-001300",
        subtotal: "1101.69",
        cgst: "99.15",
        sgst: "99.16",
        totalAmount: "1300.00",
        balanceDue: "1300.00",
        paidAmount: "0.00",
        status: "sent",
        dueDate: "2026-11-25",
        documentType: "tax_invoice",
        commercialStatus: "issued",
        items: [
          {
            description: "Daily Clean + 2 Full Washes — Monthly Service",
            quantity: 1,
            unitPrice: 1101.69,
            total: 1101.69,
            sacCode: "9987",
          },
        ],
      })
      .returning();
    invoice = inv;
  } else {
    await db
      .update(invoicesTable)
      .set({
        totalAmount: "1300.00",
        balanceDue: "1300.00",
        paidAmount: "0.00",
        status: "sent",
      })
      .where(eq(invoicesTable.id, invoice.id));
  }

  console.log(JSON.stringify({
    success: true,
    customerId: customer.id,
    userId: user.id,
    phone,
    password: "customer123",
    portal: "customer",
    rawToken,
    invoiceId: invoice.id,
    totalDues: 1300.00,
  }));
}

if (process.argv[1] && process.argv[1].includes("setup-browser-demo")) {
  setupBrowserDemo().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
