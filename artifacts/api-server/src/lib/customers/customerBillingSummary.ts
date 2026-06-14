import { db, customersTable, invoicesTable, paymentsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { getCustomerOutstandingDues } from "../billing/invoiceService";

export type CustomerBillingSummary = {
  customerId: number;
  outstandingDue: number;
  walletBalance: number;
  lastInvoice: {
    id: number;
    invoiceNumber: string;
    totalAmount: number;
    balanceDue: number;
    status: string;
    issuedAt: string | null;
  } | null;
  lastPayment: {
    id: number;
    amount: number;
    method: string;
    receivedAt: string | null;
  } | null;
};

export async function getCustomerBillingSummary(customerId: number): Promise<CustomerBillingSummary> {
  const [customer, outstandingDue, lastInvoiceRow, lastPaymentRow] = await Promise.all([
    db.select({
      walletBalance: customersTable.walletBalance,
    }).from(customersTable).where(eq(customersTable.id, customerId)).limit(1),
    getCustomerOutstandingDues(customerId),
    db.select({
      id: invoicesTable.id,
      invoiceNumber: invoicesTable.invoiceNumber,
      totalAmount: invoicesTable.totalAmount,
      balanceDue: invoicesTable.balanceDue,
      status: invoicesTable.status,
      issuedAt: invoicesTable.issuedAt,
    })
      .from(invoicesTable)
      .where(and(
        eq(invoicesTable.customerId, customerId),
        eq(invoicesTable.documentType, "tax_invoice"),
      ))
      .orderBy(desc(invoicesTable.issuedAt), desc(invoicesTable.createdAt))
      .limit(1),
    db.select({
      id: paymentsTable.id,
      amount: paymentsTable.amount,
      method: paymentsTable.method,
      receivedAt: paymentsTable.receivedAt,
    })
      .from(paymentsTable)
      .where(and(
        eq(paymentsTable.customerId, customerId),
        eq(paymentsTable.status, "completed"),
      ))
      .orderBy(desc(paymentsTable.receivedAt), desc(paymentsTable.createdAt))
      .limit(1),
  ]);

  const walletBalance = parseFloat(customer[0]?.walletBalance ?? "0");
  const inv = lastInvoiceRow[0];
  const pay = lastPaymentRow[0];

  return {
    customerId,
    outstandingDue,
    walletBalance,
    lastInvoice: inv ? {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      totalAmount: parseFloat(inv.totalAmount),
      balanceDue: parseFloat(inv.balanceDue),
      status: inv.status,
      issuedAt: inv.issuedAt ? inv.issuedAt.toISOString() : null,
    } : null,
    lastPayment: pay ? {
      id: pay.id,
      amount: parseFloat(pay.amount),
      method: pay.method,
      receivedAt: pay.receivedAt ? pay.receivedAt.toISOString() : null,
    } : null,
  };
}
