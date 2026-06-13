import { db } from "@workspace/db";
import {
  customersTable,
  walletTransactionsTable,
  subscriptionsTable,
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

/** Derive daily rate from subscription — explicit dailyRate or price/30. */
export function resolveDailyRate(sub: {
  dailyRate?: string | null;
  price: string;
}): number {
  if (sub.dailyRate != null && parseFloat(sub.dailyRate) > 0) {
    return parseFloat(sub.dailyRate);
  }
  return Math.round((parseFloat(sub.price) / 30) * 100) / 100;
}

/** Days of service remaining at current balance (Phase 4 foundation). */
export function getLowBalanceThresholdDays(): number {
  const raw = process.env.WALLET_LOW_BALANCE_DAYS;
  const parsed = raw ? parseInt(raw, 10) : 7;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 7;
}

export async function getLowBalanceThresholdAmount(
  customerId: number,
  dailyRate: number,
): Promise<number> {
  return dailyRate * getLowBalanceThresholdDays();
}

export async function isLowBalance(
  customerId: number,
  dailyRate: number,
  tx?: Transaction,
): Promise<boolean> {
  const balance = await getLedgerBalance(customerId, tx);
  const threshold = await getLowBalanceThresholdAmount(customerId, dailyRate);
  return balance < threshold;
}

export async function getActiveDailyWashSubscription(customerId: number, subscriptionId?: number | null) {
  if (subscriptionId) {
    const [sub] = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.id, subscriptionId))
      .limit(1);
    if (sub?.type === "daily_wash" && sub.status === "active") return sub;
    return null;
  }
  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(
      sql`${subscriptionsTable.customerId} = ${customerId} AND ${subscriptionsTable.type} = 'daily_wash' AND ${subscriptionsTable.status} = 'active'`,
    )
    .limit(1);
  return sub ?? null;
}

/** Resume paused daily_wash contracts when wallet balance covers at least one day. */
export async function tryAutoResumeDailyWash(customerId: number, balance?: number) {
  const { resumeSubscription } = await import("../../subscriptions/service");
  const bal = balance ?? await getLedgerBalance(customerId);
  const paused = await db
    .select()
    .from(subscriptionsTable)
    .where(
      sql`${subscriptionsTable.customerId} = ${customerId} AND ${subscriptionsTable.type} = 'daily_wash' AND ${subscriptionsTable.status} = 'paused'`,
    );

  const resumed: number[] = [];
  for (const sub of paused) {
    const dailyRate = resolveDailyRate(sub);
    if (bal >= dailyRate) {
      await resumeSubscription(sub.id);
      resumed.push(sub.id);
    }
  }
  return resumed;
}
