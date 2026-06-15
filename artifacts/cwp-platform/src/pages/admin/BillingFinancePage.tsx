import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListInvoicesQueryKey } from "@workspace/api-client-react";
import AdminLayout from "@/components/layout/AdminLayout";
import { PageActionHeader } from "@/components/layout/PageActionHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Settings2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { CreateInvoiceDialog } from "@/features/billing/components/CreateInvoiceDialog";
import { RecordPaymentDialog } from "@/features/billing/components/RecordPaymentDialog";
import { CustomerFilterBanner } from "@/features/billing/components/CustomerFilterBanner";
import { InvoicesTab } from "@/features/billing/components/InvoicesTab";
import { PaymentsTab } from "@/features/billing/components/PaymentsTab";
import { QuotationsTab } from "@/features/billing/components/QuotationsTab";
import { ExpensesTab } from "@/features/billing/components/ExpensesTab";
import { DuesTab } from "@/features/billing/components/DuesTab";
import { WalletAdjustmentsTab } from "@/features/billing/components/WalletAdjustmentsTab";
import {
  BILLING_TABS,
  BILLING_TAB_LABELS,
  billingTabFromSearch,
  type BillingTab,
} from "@/features/billing/billingTabs";

function buildBillingPath(tab: BillingTab, customerId?: string) {
  const params = new URLSearchParams();
  if (tab !== "invoices") params.set("tab", tab);
  if (customerId) params.set("customerId", customerId);
  const qs = params.toString();
  return qs ? `/admin/billing?${qs}` : "/admin/billing";
}

export default function BillingFinancePage() {
  const qc = useQueryClient();
  const [location, setLocation] = useLocation();
  const search = location.includes("?") ? location.slice(location.indexOf("?")) : "";
  const [billingTab, setBillingTab] = useState<BillingTab>(() => billingTabFromSearch(search));
  const [invOpen, setInvOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [customerFilter, setCustomerFilter] = useState<string | undefined>();
  const [prefillCustomerId, setPrefillCustomerId] = useState<number | undefined>();

  useEffect(() => {
    setBillingTab(billingTabFromSearch(search));
    const params = new URLSearchParams(search);
    const customerId = params.get("customerId");
    if (customerId) {
      setCustomerFilter(customerId);
      const idNum = parseInt(customerId, 10);
      if (idNum > 0) setPrefillCustomerId(idNum);
    } else {
      setCustomerFilter(undefined);
      setPrefillCustomerId(undefined);
    }
    const action = params.get("action");
    if (action === "create") setInvOpen(true);
    if (action === "pay") setPayOpen(true);
  }, [search]);

  const clearCustomerFilter = () => {
    setCustomerFilter(undefined);
    setPrefillCustomerId(undefined);
    setLocation(buildBillingPath(billingTab));
  };

  const handleTabChange = (value: string) => {
    const next = value as BillingTab;
    setBillingTab(next);
    setLocation(buildBillingPath(next, customerFilter));
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-5">
        <PageActionHeader
          title="Billing & Finance"
          description="Invoices, payments, dues, wallet, and expenses"
          primaryAction={{
            label: "Record payment",
            onClick: () => setPayOpen(true),
            testId: "billing-primary-cta",
          }}
          secondaryActions={
            <>
              <Link href="/admin/settings/invoice-billing">
                <Button variant="outline" size="sm">
                  <Settings2 size={15} className="mr-1.5" />Invoice & GST Settings
                </Button>
              </Link>
              <Button variant="outline" data-testid="btn-create-invoice" onClick={() => setInvOpen(true)}>
                <FileText size={15} className="mr-1.5" />Create Invoice
              </Button>
            </>
          }
        />
        <CreateInvoiceDialog
          open={invOpen}
          onOpenChange={setInvOpen}
          initialCustomerId={prefillCustomerId}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["invoices"] });
            qc.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
          }}
        />
        <RecordPaymentDialog open={payOpen} onOpenChange={setPayOpen} prefillCustomerId={prefillCustomerId} />

        {customerFilter && prefillCustomerId && (
          <CustomerFilterBanner customerId={prefillCustomerId} onClear={clearCustomerFilter} />
        )}

        <Tabs value={billingTab} onValueChange={handleTabChange}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            {BILLING_TABS.map(tab => (
              <TabsTrigger key={tab} value={tab} data-testid={`billing-tab-${tab}`}>
                {BILLING_TAB_LABELS[tab]}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="invoices" className="mt-4">
            <InvoicesTab customerId={customerFilter} />
          </TabsContent>
          <TabsContent value="payments" className="mt-4">
            <PaymentsTab customerId={customerFilter} />
          </TabsContent>
          <TabsContent value="quotations" className="mt-4">
            <QuotationsTab customerId={customerFilter} prefillCustomerId={prefillCustomerId} />
          </TabsContent>
          <TabsContent value="expenses" className="mt-4">
            <ExpensesTab />
          </TabsContent>
          <TabsContent value="dues" className="mt-4">
            <DuesTab customerId={customerFilter} />
          </TabsContent>
          <TabsContent value="wallet-adjustments" className="mt-4">
            <WalletAdjustmentsTab customerId={customerFilter} prefillCustomerId={prefillCustomerId} />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
