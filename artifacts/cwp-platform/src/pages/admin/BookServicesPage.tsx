import { useLocation } from "wouter";
import { useGetCustomer, getGetCustomerQueryKey } from "@workspace/api-client-react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BookServicesWizard } from "@/features/book-services/components/BookServicesWizard";
import { CalendarCheck } from "lucide-react";

export default function BookServicesPage() {
  const [location] = useLocation();
  const customerIdParam = new URLSearchParams(
    location.includes("?") ? location.slice(location.indexOf("?")) : "",
  ).get("customerId");
  const customerId = customerIdParam ? parseInt(customerIdParam, 10) : undefined;

  const { data: customerRow, isLoading } = useGetCustomer(customerId ?? 0, {
    query: {
      queryKey: getGetCustomerQueryKey(customerId ?? 0),
      enabled: Boolean(customerId && customerId > 0),
    },
  });

  const initialCustomer = customerRow
    ? { id: customerRow.id, name: customerRow.name, phone: customerRow.phone }
    : null;

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <div className="flex items-center gap-2 text-primary mb-1">
            <CalendarCheck size={22} />
            <h1 className="font-display text-2xl font-bold tracking-tight">Book Services</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Walk through customer, location, asset, and service details, then create a contract with quotation or invoice.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">New service booking</CardTitle>
            <CardDescription>
              Follow each step in order. The review step creates the contract, billing document, and pending assignment queue entry.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {customerId && isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <BookServicesWizard initialCustomer={initialCustomer} />
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
