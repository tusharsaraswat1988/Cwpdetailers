/**
 * @deprecated Customer portal no longer displays wallet (₹) data.
 * Use `@/lib/customer-plans` for My Plans UI.
 * These helpers remain for admin/billing compatibility only.
 */
export async function fetchWalletTransactions(
  _customerId: number,
  _limit = 50,
): Promise<never> {
  throw new Error("Wallet transactions are deprecated in the customer portal.");
}
