import { db } from "@workspace/db";
import {
  customersTable,
  walletTransactionsTable,
} from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import type { Transaction } from "../../subscriptions/service";

export type WalletPaymentMode = "cash" | "upi" | "bank_transfer" | "adjustment";

export class WalletError extends Error {
  constructor(
    message: string,
    public code: "INSUFFICIENT_BALANCE" | "INVALID_AMOUNT" | "CUSTOMER_NOT_FOUND",
  ) {
    super(message);
    this.name = "WalletError";
  }
}

/** Ledger is the source of truth — sum of credits minus debits. */
export async function getLedgerBalance(customerId: number, tx?: Transaction): Promise<number> {
  const ctx = tx ?? db;
  const [row] = await ctx
    .select({
      balance: sql<string>`coalesce(
        sum(case when ${walletTransactionsTable.type} = 'credit' then ${walletTransactionsTable.amount}::numeric else -${walletTransactionsTable.amount}::numeric end),
        0
      )`,
    })
    .from(walletTransactionsTable)
    .where(eq(walletTransactionsTable.customerId, customerId));
  return parseFloat(row?.balance ?? "0");
}

async function lockCustomer(customerId: number, tx: Transaction) {
  const [customer] = await tx
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, customerId))
    .for("update");
  if (!customer) throw new WalletError("Customer not found", "CUSTOMER_NOT_FOUND");
  return customer;
}

/** Sync denormalized cache on customers.walletBalance from ledger sum. */
export async function syncWalletBalanceCache(customerId: number, tx: Transaction) {
  const balance = await getLedgerBalance(customerId, tx);
  await tx
    .update(customersTable)
    .set({ walletBalance: balance.toFixed(2), updatedAt: new Date() })
    .where(eq(customersTable.id, customerId));
  return balance;
}

export async function creditWallet(
  params: {
    customerId: number;
    amount: number;
    paymentMode: WalletPaymentMode;
    reference?: string;
    referenceId?: number;
    notes?: string;
    createdBy?: number | null;
    companyId?: number | null;
  },
  tx?: Transaction,
) {
  if (params.amount <= 0) throw new WalletError("Amount must be positive", "INVALID_AMOUNT");

  const run = async (ctx: Transaction) => {
    await lockCustomer(params.customerId, ctx);
    const current = await getLedgerBalance(params.customerId, ctx);
    const balanceAfter = current + params.amount;

    const [entry] = await ctx
      .insert(walletTransactionsTable)
      .values({
        customerId: params.customerId,
        companyId: params.companyId ?? null,
        type: "credit",
        amount: params.amount.toFixed(2),
        balanceAfter: balanceAfter.toFixed(2),
        reference: params.reference ?? "wallet_recharge",
        referenceId: params.referenceId ?? null,
        paymentMode: params.paymentMode,
        notes: params.notes ?? null,
        createdBy: params.createdBy ?? null,
      })
      .returning();

    await syncWalletBalanceCache(params.customerId, ctx);
    return entry;
  };

  return tx ? run(tx) : db.transaction(run);
}

export async function debitWallet(
  params: {
    customerId: number;
    amount: number;
    reference: string;
    referenceId?: number;
    notes?: string;
    createdBy?: number | null;
    companyId?: number | null;
  },
  tx?: Transaction,
) {
  if (params.amount <= 0) throw new WalletError("Amount must be positive", "INVALID_AMOUNT");

  const run = async (ctx: Transaction) => {
    await lockCustomer(params.customerId, ctx);
    const current = await getLedgerBalance(params.customerId, ctx);
    if (current < params.amount) {
      throw new WalletError(
        `Insufficient wallet balance. Available: ₹${current.toFixed(2)}, required: ₹${params.amount.toFixed(2)}`,
        "INSUFFICIENT_BALANCE",
      );
    }
    const balanceAfter = current - params.amount;

    const [entry] = await ctx
      .insert(walletTransactionsTable)
      .values({
        customerId: params.customerId,
        companyId: params.companyId ?? null,
        type: "debit",
        amount: params.amount.toFixed(2),
        balanceAfter: balanceAfter.toFixed(2),
        reference: params.reference,
        referenceId: params.referenceId ?? null,
        paymentMode: null,
        notes: params.notes ?? null,
        createdBy: params.createdBy ?? null,
      })
      .returning();

    await syncWalletBalanceCache(params.customerId, ctx);
    return entry;
  };

  return tx ? run(tx) : db.transaction(run);
}

export async function listWalletTransactions(
  customerId: number,
  opts?: { limit?: number; offset?: number },
) {
  const lim = Math.min(opts?.limit ?? 50, 100);
  const off = opts?.offset ?? 0;
  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(walletTransactionsTable)
      .where(eq(walletTransactionsTable.customerId, customerId))
      .orderBy(desc(walletTransactionsTable.createdAt))
      .limit(lim)
      .offset(off),
    db
      .select({ count: sql<number>`count(*)` })
      .from(walletTransactionsTable)
      .where(eq(walletTransactionsTable.customerId, customerId)),
  ]);
  return {
    data: data.map((row) => ({
      ...row,
      amount: parseFloat(row.amount),
      balanceAfter: parseFloat(row.balanceAfter),
    })),
    total: Number(countResult[0]?.count ?? 0),
    limit: lim,
    offset: off,
  };
}
