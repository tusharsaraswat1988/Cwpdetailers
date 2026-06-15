import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, MapPin, Pencil, Link2, Unlink } from "lucide-react";
import {
  getServiceLocation,
  updateServiceLocation,
  linkCustomerToLocation,
  unlinkCustomerFromLocation,
  SERVICE_LOCATION_TYPE_LABELS,
} from "@/features/service-locations/api";
import {
  ServiceLocationForm,
  serviceLocationFormToPayload,
  serviceLocationToFormValues,
} from "@/features/service-locations/components/ServiceLocationForm";
import { CustomerProfileBackLink } from "@/components/layout/CustomerBookingDataContext";
import { CustomerSearchSelect, type CustomerSearchValue } from "@/features/customers/components/CustomerSearchSelect";

export default function ServiceLocationDetail() {
  const [, params] = useRoute("/admin/service-locations/:id");
  const id = parseInt(params?.id ?? "", 10);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(serviceLocationToFormValues({
    label: "",
    locationType: "other",
    status: "active",
  }));
  const [linkCustomer, setLinkCustomer] = useState<CustomerSearchValue | null>(null);
  const [linkDefault, setLinkDefault] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveUntil, setEffectiveUntil] = useState("");
  const [linking, setLinking] = useState(false);

  const { data: location, isLoading, refetch } = useQuery({
    queryKey: ["service-location", id],
    queryFn: () => getServiceLocation(id),
    enabled: Number.isFinite(id) && id > 0,
  });

  const startEdit = () => {
    if (!location) return;
    setForm(serviceLocationToFormValues(location));
    setEditing(true);
  };

  const handleSave = async () => {
    if (!form.label.trim()) {
      toast({ title: "Site label is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await updateServiceLocation(id, serviceLocationFormToPayload(form));
      toast({ title: "Service address updated" });
      setEditing(false);
      await refetch();
      qc.invalidateQueries({ queryKey: ["service-locations"] });
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLink = async () => {
    if (!linkCustomer?.id) {
      toast({ title: "Select a customer", variant: "destructive" });
      return;
    }
    setLinking(true);
    try {
      await linkCustomerToLocation(id, {
        customerId: linkCustomer.id,
        isDefault: linkDefault,
        effectiveFrom: effectiveFrom || undefined,
        effectiveUntil: effectiveUntil || undefined,
      });
      toast({ title: "Customer linked" });
      setLinkCustomer(null);
      setLinkDefault(false);
      setEffectiveFrom("");
      setEffectiveUntil("");
      await refetch();
      qc.invalidateQueries({ queryKey: ["service-locations"] });
    } catch (err) {
      toast({
        title: "Link failed",
        description: err instanceof Error ? err.message : "Error",
        variant: "destructive",
      });
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async (customerId: number) => {
    try {
      await unlinkCustomerFromLocation(id, customerId);
      toast({ title: "Customer unlinked" });
      await refetch();
      qc.invalidateQueries({ queryKey: ["service-locations"] });
    } catch (err) {
      toast({
        title: "Unlink failed",
        description: err instanceof Error ? err.message : "Error",
        variant: "destructive",
      });
    }
  };

  const primaryCustomerId = location?.customerLinks?.find(l => l.isDefault)?.customerId
    ?? location?.customerLinks?.[0]?.customerId;

  if (!Number.isFinite(id) || id <= 0) return null;

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-3xl">
        {primaryCustomerId ? (
          <CustomerProfileBackLink customerId={primaryCustomerId} label="Back to customer profile" />
        ) : (
          <Link href="/admin/customers" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            <ArrowLeft size={14} /> Back to Customer Profile
          </Link>
        )}

        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : location ? (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-display font-bold text-2xl flex items-center gap-2">
                    <MapPin size={22} className="text-primary" />
                    {location.label}
                  </h1>
                  {location.isAutoCreated && <Badge variant="outline">Auto-created</Badge>}
                  <Badge variant="outline" className={location.status === "active" ? "text-green-600" : ""}>
                    {location.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {SERVICE_LOCATION_TYPE_LABELS[location.locationType]}
                  {location.city ? ` · ${location.city}` : ""}
                </p>
                {location.address && <p className="text-sm mt-2">{location.address}</p>}
                {(location.latitude != null && location.longitude != null) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {location.latitude}, {location.longitude}
                  </p>
                )}
              </div>
              {!editing && (
                <Button variant="outline" size="sm" onClick={startEdit} data-testid="btn-edit-service-location">
                  <Pencil size={14} className="mr-1.5" />Edit
                </Button>
              )}
            </div>

            {editing && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Edit location</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ServiceLocationForm values={form} onChange={setForm} idPrefix="edit-location" />
                  <div className="flex gap-2">
                    <Button onClick={handleSave} disabled={saving} data-testid="btn-save-service-location">
                      {saving ? "Saving..." : "Save changes"}
                    </Button>
                    <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Link2 size={16} className="text-primary" /> Customer links
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(location.customerLinks ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No customers linked yet.</p>
                ) : (
                  <div className="space-y-2">
                    {location.customerLinks.map(link => (
                      <div
                        key={link.id}
                        className="flex items-center justify-between gap-3 border border-border rounded-lg px-3 py-2 text-sm"
                        data-testid={`location-customer-link-${link.customerId}`}
                      >
                        <div>
                          <Link href={`/admin/customers/${link.customerId}`} className="font-medium text-primary hover:underline">
                            {link.customerName ?? `Customer #${link.customerId}`}
                          </Link>
                          <p className="text-xs text-muted-foreground">{link.customerPhone}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {link.effectiveFrom ?? "—"} → {link.effectiveUntil ?? "open"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {link.isDefault && <Badge variant="secondary" className="text-xs">Default</Badge>}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleUnlink(link.customerId)}
                            data-testid={`btn-unlink-customer-${link.customerId}`}
                          >
                            <Unlink size={14} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-t border-border pt-4 space-y-3">
                  <p className="text-sm font-medium">Link customer</p>
                  <CustomerSearchSelect value={linkCustomer} onChange={setLinkCustomer} />
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="link-effective-from">Effective from</Label>
                      <Input
                        id="link-effective-from"
                        type="date"
                        value={effectiveFrom}
                        onChange={e => setEffectiveFrom(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="link-effective-until">Effective until</Label>
                      <Input
                        id="link-effective-until"
                        type="date"
                        value={effectiveUntil}
                        onChange={e => setEffectiveUntil(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={linkDefault} onCheckedChange={v => setLinkDefault(Boolean(v))} />
                    Set as customer default location
                  </label>
                  <Button onClick={handleLink} disabled={linking} data-testid="btn-link-customer">
                    {linking ? "Linking..." : "Link customer"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <p className="text-muted-foreground">Service address not found.</p>
        )}
      </div>
    </AdminLayout>
  );
}
