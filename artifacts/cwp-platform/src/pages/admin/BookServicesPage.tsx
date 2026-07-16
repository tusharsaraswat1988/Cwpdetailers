import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import AdminLayout from "@/components/layout/AdminLayout";
import { PageActionHeader } from "@/components/layout/PageActionHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BookServicesWizard } from "@/features/book-services/components/BookServicesWizard";

function parseCustomerIdFromUrl(location: string): number | undefined {
  const search = typeof window !== "undefined"
    ? window.location.search
    : (location.includes("?") ? location.slice(location.indexOf("?")) : "");
  const raw = new URLSearchParams(search).get("customerId");
  if (!raw) return undefined;
  const id = parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 ? id : undefined;
}

export default function BookServicesPage() {
  const [location] = useLocation();
  const customerId = parseCustomerIdFromUrl(location);

  const { data: customerRow, isLoading } = useQuery({
    queryKey: ["book-services", "customer", customerId],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${customerId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Customer not found");
      return res.json() as Promise<{ id: number; name: string; phone: string }>;
    },
    enabled: Boolean(customerId),
  });

  const initialCustomer = customerRow
    ? { id: customerRow.id, name: customerRow.name, phone: customerRow.phone }
    : null;

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-6 p-6">
        <PageActionHeader
          title="Create Service Request"
          description="Operational entry for every CWP service — walk-in, phone, WhatsApp, or existing customer. Creates quotation, booking, and assignment queue entry."
          primaryAction={{
            label: "Leads & CRM",
            href: "/admin/leads",
            testId: "book-service-leads-cta",
          }}
        />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">New service request</CardTitle>
            <CardDescription>
              Follow how a service advisor works: customer → asset → where we work → what to sell → pricing → confirm.
              Create customers, assets, and locations inline without leaving this flow.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {customerId && (isLoading || !customerRow) ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <BookServicesWizard
                key={customerId ? `customer-${customerId}` : "new-booking"}
                initialCustomer={initialCustomer}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
