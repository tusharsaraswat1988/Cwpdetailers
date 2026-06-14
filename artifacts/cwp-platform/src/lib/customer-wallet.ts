export async function fetchWalletTransactions(customerId: number, limit = 50) {
  const res = await fetch(`/api/customers/${customerId}/wallet/transactions?limit=${limit}`, {
    credentials: "include",
  });
  if (!res.ok) return { data: [] as WalletTransaction[] };
  return res.json() as Promise<{ data: WalletTransaction[] }>;
}

export async function fetchWalletSummary(customerId: number) {
  const res = await fetch(`/api/customers/${customerId}/wallet`, { credentials: "include" });
  if (!res.ok) return null;
  return res.json() as Promise<WalletSummary | null>;
}

export type WalletTransaction = {
  id: number;
  type: "credit" | "debit";
  amount: string | number;
  reference?: string | null;
  createdAt: string;
  balanceAfter?: string | number | null;
};

export type WalletSummary = {
  balance?: number;
};
