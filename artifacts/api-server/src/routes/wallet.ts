import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { rowInScope, loadIfInScope } from "../middlewares/tenantScope";
import {
  creditWallet,
  listWalletTransactions,
  getLedgerBalance,
  WalletError,
  isLowBalance,
  getLowBalanceThresholdDays,
  resolveDailyRate,
  getActiveDailyWashSubscription,
  tryAutoResumeDailyWash,
} from "../lib/wallet/service";

const router = Router();

function isAdminRole(req: { user?: { role?: string }; scope?: { isSuperAdmin?: boolean } }) {
  return req.scope?.isSuperAdmin || ["admin", "superadmin", "manager"].includes(req.user?.role ?? "");
}

router.get("/customers/:id/wallet", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const customer = await loadIfInScope(
      req,
      () => db.select().from(customersTable).where(eq(customersTable.id, id)).limit(1).then((r) => r[0]),
      (r) => ({ ...r, customerId: r.id }),
    );
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const balance = await getLedgerBalance(id);
    const dailySub = await getActiveDailyWashSubscription(id);
    const dailyRate = dailySub ? resolveDailyRate(dailySub) : null;
    const lowBalanceThresholdDays = getLowBalanceThresholdDays();
    const lowBalanceThreshold = dailyRate != null ? dailyRate * lowBalanceThresholdDays : null;
    const lowBalance = dailyRate != null ? await isLowBalance(id, dailyRate) : false;

    return res.json({
      customerId: id,
      balance,
      lowBalanceThresholdDays,
      lowBalanceThreshold,
      dailyRate,
      isLowBalance: lowBalance,
    });
  } catch (err) {
    req.log.error({ err }, "Get wallet error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/customers/:id/wallet/transactions", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { limit = "50", offset = "0" } = req.query as Record<string, string>;
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, id)).limit(1);
    if (!customer || !rowInScope(req, { ...customer, customerId: customer.id })) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const result = await listWalletTransactions(id, {
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "List wallet transactions error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/customers/:id/wallet/credit", async (req, res) => {
  try {
    if (!isAdminRole(req)) {
      return res.status(403).json({ error: "Only admin can credit wallet" });
    }

    const id = parseInt(req.params.id);
    const { amount, paymentMode, notes } = req.body as {
      amount?: number;
      paymentMode?: "cash" | "upi" | "bank_transfer";
      notes?: string;
    };

    if (!amount || amount <= 0) return res.status(400).json({ error: "Positive amount is required" });
    if (!paymentMode || !["cash", "upi", "bank_transfer"].includes(paymentMode)) {
      return res.status(400).json({ error: "paymentMode must be cash, upi, or bank_transfer" });
    }

    const customer = await loadIfInScope(
      req,
      () => db.select().from(customersTable).where(eq(customersTable.id, id)).limit(1).then((r) => r[0]),
      (r) => ({ ...r, customerId: r.id }),
    );
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const entry = await creditWallet({
      customerId: id,
      amount,
      paymentMode,
      reference: "wallet_recharge",
      notes: notes ?? `Recharge via ${paymentMode}`,
      createdBy: req.user?.id ?? null,
      companyId: customer.companyId,
    });

    const balance = await getLedgerBalance(id);
    const resumedSubscriptions = await tryAutoResumeDailyWash(id, balance);
    return res.status(201).json({
      transaction: {
        ...entry,
        amount: parseFloat(entry.amount),
        balanceAfter: parseFloat(entry.balanceAfter),
      },
      balance,
      resumedSubscriptions,
    });
  } catch (err) {
    if (err instanceof WalletError) {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    req.log.error({ err }, "Wallet credit error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
