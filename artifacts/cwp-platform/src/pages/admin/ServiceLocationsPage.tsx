import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Plus, Search, Users } from "lucide-react";
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

export default function ServiceLocationsPage() {
  const { toast } = useToast();
  const [location] = useLocation();
  const customerIdParam = new URLSearchParams(location.includes("?") ? location.slice(location.indexOf("?")) : "").get("customerId");
  const filterCustomerId = customerIdParam ? parseInt(customerIdParam, 10) : undefined;
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_SERVICE_LOCATION_FORM);
  const [creating, setCreating] = useState(false);

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
      toast({ title: "Site label is required", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const created = await createServiceLocation(serviceLocationFormToPayload(form));
      toast({ title: "Service location created" });
      setCreateOpen(false);
      setForm(EMPTY_SERVICE_LOCATION_FORM);
      await refetch();
      window.location.href = `/admin/service-locations/${created.id}`;
    } catch (err) {
      toast({
        title: "Failed to create location",
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl">Service Locations</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {filterCustomerId
                ? `Locations linked to customer #${filterCustomerId}`
                : "Site masters where work is performed — linked to customers"}
            </p>
            {filterCustomerId && (
              <Link href="/admin/service-locations" className="text-xs text-primary hover:underline mt-1 inline-block">
                Clear customer filter
              </Link>
            )}
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-secondary hover:bg-primary/90" data-testid="btn-add-service-location">
                <Plus size={15} className="mr-1.5" />Add location
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>New service location</DialogTitle>
              </DialogHeader>
              <ServiceLocationForm values={form} onChange={setForm} idPrefix="create-location" />
              <Button
                onClick={handleCreate}
                disabled={creating}
                className="w-full bg-primary text-secondary hover:bg-primary/90"
                data-testid="btn-submit-service-location"
              >
                {creating ? "Creating..." : "Create location"}
              </Button>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search label, address, city..."
            className="pl-9"
            data-testid="input-service-locations-search"
          />
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 w-full rounded-xl" />)
            : locations.map(loc => (
              <Link key={loc.id} href={`/admin/service-locations/${loc.id}`}>
                <div
                  className="bg-card border border-border rounded-2xl p-5 hover:border-primary/40 transition-colors cursor-pointer h-full"
                  data-testid={`service-location-card-${loc.id}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <MapPin size={18} className="text-primary" />
                    </div>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {loc.isAutoCreated && (
                        <Badge variant="outline" className="text-xs">Auto</Badge>
                      )}
                      <Badge variant="outline" className={`text-xs ${loc.status === "active" ? "text-green-600 border-green-500/30" : ""}`}>
                        {loc.status}
                      </Badge>
                    </div>
                  </div>
                  <h3 className="font-semibold text-base">{loc.label}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {SERVICE_LOCATION_TYPE_LABELS[loc.locationType]}
                    {loc.city ? ` · ${loc.city}` : ""}
                  </p>
                  {loc.address && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{loc.address}</p>}
                  <div className="flex items-center gap-1.5 mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
                    <Users size={11} />
                    <span>{loc.linkedCustomerCount ?? 0} linked customers</span>
                  </div>
                </div>
              </Link>
            ))}
        </div>

        {!isLoading && locations.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-12">No service locations found.</p>
        )}
      </div>
    </AdminLayout>
  );
}
