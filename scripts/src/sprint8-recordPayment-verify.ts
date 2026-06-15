/**
 * Sprint 8 regression — recordPayment settlement, overpayment credits, wallet adjustments.
 * Usage: npx tsx scripts/src/sprint8-recordPayment-verify.ts
 */
import { db, customersTable, invoicesTable, paymentsTable, walletTransactionsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { creditWallet, getLedgerBalance } from "../../artifacts/api-server/src/lib/wallet/service.ts";
import { createInvoice, recordPayment } from "../../artifacts/api-server/src/lib/billing/invoiceService.ts";

async function main() {
  const results: { name: string; pass: boolean; detail?: string }[] = [];
  const log = (name: string, pass: boolean, detail?: string) => {
    results.push({ name, pass, detail });
    console.log(`${pass ? "PASS" : "FAIL"} — ${name}${detail ? `: ${detail}` : ""}`);
  };

  console.log("=== Sprint 8 recordPayment Regression ===\n");

  const [customer] = await db.select().from(customersTable).limit(1);
  if (!customer) throw new Error("No customer in DB for regression test");

  const customerId = customer.id;
  const companyId = customer.companyId;
  const branchId = customer.branchId;

  // --- Test 1: Full invoice settlement ---
  const inv1 = await createInvoice({
    customerId,
    items: [{
      description: "S8 test service",
      quantity: 1,
      unitPrice: 1000,
      total: 1000,
      sac: "998533",
      serviceCategory: "service",
    }],
    gstInclusive: true,
    status: "sent",
    companyId,
    branchId,
  });

  await recordPayment({
    customerId,
    invoiceId: inv1.id,
    amount: parseFloat(inv1.totalAmount),
    method: "cash",
    companyId,
    branchId,
  });

  const [inv1After] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, inv1.id)).limit(1);
  log(
    "Invoice settlement (full pay)",
    parseFloat(inv1After.balanceDue) === 0 && inv1After.status === "paid",
    `balanceDue=${inv1After.balanceDue}, status=${inv1After.status}`,
  );

  // --- Test 2: Overpayment credits wallet ---
  const balanceBeforeOverpay = await getLedgerBalance(customerId);

  const inv2 = await createInvoice({
    customerId,
    items: [{
      description: "S8 overpay test",
      quantity: 1,
      unitPrice: 500,
      total: 500,
      sac: "998533",
      serviceCategory: "service",
    }],
    gstInclusive: true,
    status: "sent",
    companyId,
    branchId,
  });

  const due = parseFloat(inv2.balanceDue);
  const overpayAmount = due + 200;

  await recordPayment({
    customerId,
    invoiceId: inv2.id,
    amount: overpayAmount,
    method: "upi",
    companyId,
    branchId,
  });

  const [inv2After] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, inv2.id)).limit(1);
  const balanceAfterOverpay = await getLedgerBalance(customerId);
  const overpayCredit = balanceAfterOverpay - balanceBeforeOverpay;

  log(
    "Overpayment → wallet credit",
    parseFloat(inv2After.balanceDue) === 0 && Math.abs(overpayCredit - 200) < 0.01,
    `wallet credit ₹${overpayCredit.toFixed(2)}, invoice balanceDue=${inv2After.balanceDue}`,
  );

  // --- Test 3: Pay with wallet (useWallet) ---
  await creditWallet({
    customerId,
    amount: 300,
    paymentMode: "cash",
    reference: "s8_test_fund",
    notes: "S8 wallet pay test fund",
    companyId,
  });

  const inv3 = await createInvoice({
    customerId,
    items: [{
      description: "S8 wallet offset test",
      quantity: 1,
      unitPrice: 400,
      total: 400,
      sac: "998533",
      serviceCategory: "service",
    }],
    gstInclusive: true,
    status: "sent",
    companyId,
    branchId,
  });

  const walletBeforePay = await getLedgerBalance(customerId);
  const inv3Due = parseFloat(inv3.balanceDue);

  await recordPayment({
    customerId,
    invoiceId: inv3.id,
    amount: 0,
    method: "cash",
    useWallet: true,
    companyId,
    branchId,
  });

  const [inv3After] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, inv3.id)).limit(1);
  const walletAfterPay = await getLedgerBalance(customerId);
  const walletUsed = walletBeforePay - walletAfterPay;
  const expectedWalletUse = Math.min(walletBeforePay, inv3Due);

  log(
    "Pay with wallet (useWallet)",
    Math.abs(walletUsed - expectedWalletUse) < 0.01 && parseFloat(inv3After.balanceDue) <= inv3Due - expectedWalletUse + 0.01,
    `wallet used ₹${walletUsed.toFixed(2)}, remaining due ₹${inv3After.balanceDue}`,
  );

  // --- Test 4: Wallet debit audit trail from invoice_payment ---
  const [lastWalletDebit] = await db
    .select()
    .from(walletTransactionsTable)
    .where(and(eq(walletTransactionsTable.customerId, customerId), eq(walletTransactionsTable.type, "debit")))
    .orderBy(desc(walletTransactionsTable.createdAt))
    .limit(1);

  log(
    "Wallet debit audit trail exists",
    !!lastWalletDebit?.notes,
    lastWalletDebit?.notes ?? "no debit tx",
  );

  const [walletPayment] = await db
    .select()
    .from(paymentsTable)
    .where(and(eq(paymentsTable.customerId, customerId), eq(paymentsTable.method, "wallet")))
    .orderBy(desc(paymentsTable.createdAt))
    .limit(1);

  log(
    "Wallet payment row recorded",
    !!walletPayment,
    walletPayment ? `payment #${walletPayment.id} ₹${walletPayment.amount}` : undefined,
  );

  const failed = results.filter(r => !r.pass);
  console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===`);
  if (failed.length) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
