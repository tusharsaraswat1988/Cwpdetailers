/**
 * Phase 3 verification script — wallet, invoice, notification flows.
 * Usage: npx tsx scripts/src/phase3-verify.ts
 */
import { db, customersTable, walletTransactionsTable, invoicesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { creditWallet, debitWallet, getLedgerBalance } from "../../artifacts/api-server/src/lib/wallet/service.ts";
import { dispatchNotification } from "../../artifacts/api-server/src/lib/notifications/dispatcher.ts";
import { splitGstInclusive } from "../../artifacts/api-server/src/lib/gst.ts";

async function main() {
  const results: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    results.push(msg);
  };

  log("=== Phase 3 Verification ===\n");

  const [customer] = await db.select().from(customersTable).where(eq(customersTable.phone, "9001001001")).limit(1);
  if (!customer) throw new Error("Pilot customer Arjun not found");
  log(`Customer: ${customer.name} (id=${customer.id})`);

  const balanceBefore = await getLedgerBalance(customer.id);
  log(`Ledger balance before credit: ₹${balanceBefore}`);

  const credit = await creditWallet({
    customerId: customer.id,
    amount: 500,
    paymentMode: "upi",
    reference: "wallet_recharge",
    notes: "Phase 3 verification credit",
    companyId: customer.companyId,
  });
  log(`Credit entry: +₹${credit.amount}, balanceAfter=₹${credit.balanceAfter}`);

  const balanceAfterCredit = await getLedgerBalance(customer.id);
  log(`Ledger balance after credit: ₹${balanceAfterCredit}`);

  const debit = await debitWallet({
    customerId: customer.id,
    amount: 100,
    reference: "daily_cleaning",
    referenceId: 99999,
    notes: "Phase 3 verification debit",
    companyId: customer.companyId,
  });
  log(`Debit entry: -₹${debit.amount}, balanceAfter=₹${debit.balanceAfter}`);

  const finalBalance = await getLedgerBalance(customer.id);
  const [sumRow] = await db
    .select({
      computed: sql<string>`coalesce(
        sum(case when ${walletTransactionsTable.type} = 'credit' then ${walletTransactionsTable.amount}::numeric else -${walletTransactionsTable.amount}::numeric end),
        0
      )`,
    })
    .from(walletTransactionsTable)
    .where(eq(walletTransactionsTable.customerId, customer.id));

  const ledgerSum = parseFloat(sumRow.computed);
  const cacheBal = parseFloat((await db.select().from(customersTable).where(eq(customersTable.id, customer.id)))[0].walletBalance);
  log(`Final ledger balance: ₹${finalBalance}`);
  log(`Ledger sum matches balance: ${ledgerSum === finalBalance ? "PASS" : "FAIL"} (${ledgerSum} vs ${finalBalance})`);
  log(`Cache walletBalance synced: ${cacheBal === finalBalance ? "PASS" : "FAIL"} (${cacheBal} vs ${finalBalance})`);

  const gst = splitGstInclusive(1180);
  log(`GST inclusive split ₹1180 → subtotal ₹${gst.subtotal}, gst ₹${gst.gst}, total ₹${gst.total}`);

  const [invCount] = await db.select({ count: sql<number>`count(*)::int` }).from(invoicesTable);
  log(`Invoices in DB: ${invCount.count}`);

  const notif = await dispatchNotification({
    template: "booking_confirmed",
    customerId: customer.id,
    vars: { customerName: customer.name, serviceName: "Basic Wash", scheduledDate: "2026-06-14" },
    channels: ["in_app"],
    dedupeKey: `phase3-verify-${Date.now()}`,
  });
  log(`Notification dispatch (in_app only): ${JSON.stringify(notif)}`);

  log("\n=== Verification complete ===");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
