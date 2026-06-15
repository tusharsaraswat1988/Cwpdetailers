import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useGetCustomer, getGetCustomerQueryKey } from "@workspace/api-client-react";
import AdminLayout from "@/components/layout/AdminLayout";
import { CustomerBookingDataBanner, CustomerProfileBackLink } from "@/components/layout/CustomerBookingDataContext";
import { PageActionHeader } from "@/components/layout/PageActionHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search } from "lucide-react";
import {
  createServiceLocation,
  listServiceLocations,
  SERVICE_LOCATION_TYPE_LABELS,
  type ServiceLocation,
} from "@/features/service-locations/api";
import {
  EMPTY_SERVICE_LOCATION_FORM,
  ServiceLocationForm,
  serviceLocationFormToPayload,
} from "@/features/service-locations/components/ServiceLocationForm";

function locationCardTitle(loc: ServiceLocation) {
  if (loc.primaryCustomerName) return loc.primaryCustomerName;
  const count = loc.linkedCustomerCount ?? 0;
  if (count > 1) return `${count} customers`;
  if (count === 1) return "1 customer";
  return "No customer linked";
}

export default function ServiceLocationsPage() {
  const { toast } = useToast();
  const [location] = useLocation();
  const customerIdParam = new URLSearchParams(location.includes("?") ? location.slice(location.indexOf("?")) : "").get("customerId");
  const filterCustomerId = customerIdParam ? parseInt(customerIdParam, 10) : undefined;
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_SERVICE_LOCATION_FORM);
  const [creating, setCreating] = useState(false);

  const { data: filterCustomer } = useGetCustomer(filterCustomerId ?? 0, {
    query: { queryKey: getGetCustomerQueryKey(filterCustomerId ?? 0), enabled: Boolean(filterCustomerId) },
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["service-locations", search, filterCustomerId],
    queryFn: () => listServiceLocations({
      search: search || undefined,
      customerId: filterCustomerId,
      limit: 100,
    }),
  });

  const locations = (data?.data ?? []) as ServiceLocation[];

  const handleCreate = async () => {
    if (!form.label.trim()) {
      toast({ title: "Address label is required", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      await createServiceLocation(serviceLocationFormToPayload(form));
      toast({ title: "Service address added" });
      setCreateOpen(false);
      setForm(EMPTY_SERVICE_LOCATION_FORM);
      await refetch();
      const customerId = filterCustomerId;
      if (customerId) {
        window.location.href = `/admin/customers/${customerId}?tab=profile`;
      }
    } catch (err) {
      toast({
        title: "Failed to add service address",
        description: err instanceof Error ? err.message : "Error",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-5">
        <PageActionHeader
          title={filterCustomer && filterCustomerId ? `Service addresses — ${filterCustomer.name}` : "Service addresses"}
          description={
            filterCustomer && filterCustomerId
              ? "Customer-owned booking data — where services are delivered."
              : "Admin view only. Open from Customer Profile → Booking setup."
          }
          primaryAction={{
            label: filterCustomerId ? "Add address" : "Open Customer Profile",
            onClick: filterCustomerId ? () => setCreateOpen(true) : undefined,
            href: filterCustomerId ? undefined : "/admin/customers",
            testId: "locations-primary-cta",
          }}
          secondaryActions={
            filterCustomerId ? (
              <CustomerProfileBackLink customerId={filterCustomerId} customerName={filterCustomer?.name} />
            ) : undefined
          }
        />

        <CustomerBookingDataBanner
          entityLabel="Service addresses"
          customerId={filterCustomerId}
          customerName={filterCustomer?.name}
        />

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>New service address</DialogTitle>
            </DialogHeader>
            <ServiceLocationForm values={form} onChange={setForm} idPrefix="create-location" />
            <Button
              onClick={handleCreate}
              disabled={creating}
              className="w-full bg-primary text-secondary hover:bg-primary/90"
              data-testid="btn-submit-service-location"
            >
              {creating ? "Creating..." : "Save"}
            </Button>
          </DialogContent>
        </Dialog>

        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search customer, address, city..."
            className="pl-9"
            data-testid="input-service-locations-search"
          />
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 w-full rounded-xl" />)
            : locations.map(loc => (
              <div
                key={loc.id}
                className="bg-card border border-border rounded-2xl p-5 h-full"
                data-testid={`service-location-card-${loc.id}`}
              >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-base leading-snug">{locationCardTitle(loc)}</h3>
                    <div className="flex flex-wrap gap-1 justify-end shrink-0">
                      {loc.isAutoCreated && (
                        <Badge variant="outline" className="text-xs">Auto</Badge>
                      )}
                      <Badge variant="outline" className={`text-xs ${loc.status === "active" ? "text-green-600 border-green-500/30" : ""}`}>
                        {loc.status}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-foreground/90">{loc.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {SERVICE_LOCATION_TYPE_LABELS[loc.locationType]}
                    {loc.city ? ` · ${loc.city}` : ""}
                  </p>
                  {loc.address && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{loc.address}</p>}
                </div>
            ))}
        </div>

        {!isLoading && locations.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-12">No service addresses found.</p>
        )}
      </div>
    </AdminLayout>
  );
}
