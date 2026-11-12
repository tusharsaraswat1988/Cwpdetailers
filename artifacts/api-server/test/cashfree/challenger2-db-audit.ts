import "./harness/loadEnv";
import {
  db,
  customersTable,
  invoicesTable,
  paymentsTable,
  paymentAttemptsTable,
  usersTable,
  sessionsTable,
} from "@workspace/db";
import { sql } from "drizzle-orm";

async function main() {
  const customers = await db
    .select()
    .from(customersTable)
    .where(sql`${customersTable.name} LIKE '%Cashfree%'`);

  const invoices = await db
    .select()
    .from(invoicesTable)
    .where(sql`${invoicesTable.invoiceNumber} LIKE '%INV-CF%'`);

  const payments = await db
    .select()
    .from(paymentsTable)
    .where(sql`${paymentsTable.method} = 'cashfree'`);

  const attempts = await db.select().from(paymentAttemptsTable);

  const users = await db
    .select()
    .from(usersTable)
    .where(sql`${usersTable.name} LIKE 'Admin Test %'`);

  console.log("=== DB AUDIT DETAILS ===");
  console.log("Cashfree Customers:", customers);
  console.log("Cashfree Invoices:", invoices);
  console.log("Cashfree Payments:", payments);
  console.log("Payment Attempts:", attempts);
  console.log("Admin Users:", users);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("DB audit failed:", err);
    process.exit(1);
  });
