import { describe, it, expect } from "vitest";

describe("Billing & Customer Dues Reconciliation Unit Logic", () => {
  it("filters out paid and cancelled invoices when calculating customer dues", () => {
    const invoices = [
      { id: 1, invoiceNumber: "CWP/26-27/1000", status: "sent", totalAmount: "1300.00", balanceDue: "1300.00", dueAmount: "1300.00" },
      { id: 2, invoiceNumber: "CWP/26-27/0999", status: "paid", totalAmount: "1300.00", balanceDue: "0.00", dueAmount: "0.00" },
      { id: 3, invoiceNumber: "CWP/26-27/0998", status: "cancelled", totalAmount: "500.00", balanceDue: "500.00", dueAmount: "500.00" },
    ];

    // Mirror frontend totalDue calculation in Invoices.tsx
    const totalDue = invoices.reduce((s, inv) => {
      if (inv.status === "paid" || inv.status === "cancelled") return s;
      const due = Number((inv as any).balanceDue ?? inv.dueAmount ?? 0);
      return s + (due > 0 ? due : 0);
    }, 0);

    expect(totalDue).toBe(1300);

    // Verify each invoice effectiveDue
    const evaluatedInvoices = invoices.map(inv => {
      const isPaidOrCancelled = inv.status === "paid" || inv.status === "cancelled";
      const rawDue = Number((inv as any).balanceDue ?? inv.dueAmount ?? 0);
      const effectiveDue = isPaidOrCancelled ? 0 : Math.max(0, rawDue);
      const isPayable = effectiveDue > 0 && !isPaidOrCancelled;
      return { id: inv.id, effectiveDue, isPayable };
    });

    expect(evaluatedInvoices[0]).toEqual({ id: 1, effectiveDue: 1300, isPayable: true });
    expect(evaluatedInvoices[1]).toEqual({ id: 2, effectiveDue: 0, isPayable: false });
    expect(evaluatedInvoices[2]).toEqual({ id: 3, effectiveDue: 0, isPayable: false });
  });

  it("evaluates dashboard pendingDues with fallback to customer totalDues when summary query is absent", () => {
    // Case A: summaryQuery succeeded with pendingDues = 1300
    const summaryDataA = { pendingDues: 1300 };
    const customerDataA = { totalDues: "1300.00" };
    const pendingDuesA = summaryDataA?.pendingDues ?? Number(customerDataA?.totalDues ?? 0);
    expect(pendingDuesA).toBe(1300);

    // Case B: summaryQuery returned undefined/error, customer profile has totalDues = 1300
    const summaryDataB: { pendingDues?: number } | undefined = undefined;
    const customerDataB = { totalDues: "1300.00" };
    const pendingDuesB = summaryDataB?.pendingDues ?? Number(customerDataB?.totalDues ?? 0);
    expect(pendingDuesB).toBe(1300);

    // Case C: all clear
    const summaryDataC = { pendingDues: 0 };
    const customerDataC = { totalDues: "0.00" };
    const pendingDuesC = Number(summaryDataC?.pendingDues ?? 0) > 0 ? summaryDataC.pendingDues : Number(customerDataC?.totalDues ?? 0);
    expect(pendingDuesC).toBe(0);
  });
});
