import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdminServices } from "@/features/service-catalog/api";
import { useCities } from "@/features/master-data/api";
import { useCityAvailability } from "@/features/service-catalog/api";
import { useToast } from "@/hooks/use-toast";

async function postCityAvailability(data: Record<string, unknown>) {
  const res = await fetch("/api/catalog/city-availability", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { error?: string }).error ?? "Failed");
  return res.json();
}

export function PricingTab() {
  const { toast } = useToast();
  const { data: services } = useAdminServices();
  const { data: cities } = useCities();
  const [serviceId, setServiceId] = useState("");
  const { data: availability, refetch } = useCityAvailability(serviceId ? parseInt(serviceId) : undefined);
  const [cityId, setCityId] = useState("");
  const [override, setOverride] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!serviceId || !cityId) return;
    setSaving(true);
    try {
      await postCityAvailability({
        serviceId: parseInt(serviceId),
        cityId: parseInt(cityId),
        basePriceOverride: override || null,
        isActive: true,
      });
      toast({ title: "City pricing saved" });
      refetch();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Set City Price Override</CardTitle>
          <CardDescription>Same service, different city — e.g. Daily Cleaning ₹1000 vs ₹1100</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Service</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select service" /></SelectTrigger>
              <SelectContent>
                {(services ?? []).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>City</Label>
            <Select value={cityId} onValueChange={setCityId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select city" /></SelectTrigger>
              <SelectContent>
                {(cities ?? []).map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Base Price Override (₹)</Label>
            <Input type="number" value={override} onChange={e => setOverride(e.target.value)} className="mt-1" placeholder="Leave empty for matrix only" />
          </div>
          <Button onClick={save} disabled={saving || !serviceId || !cityId} className="w-full">Save City Pricing</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Active City Rules</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {(availability ?? []).map(row => (
            <div key={row.id} className="flex justify-between border rounded p-2">
              <span>City #{row.cityId}</span>
              <span>{row.basePriceOverride ? `₹${row.basePriceOverride}` : "Matrix pricing"}</span>
            </div>
          ))}
          {!serviceId && <p className="text-muted-foreground">Select a service to view rules.</p>}
          {serviceId && !(availability ?? []).length && <p className="text-muted-foreground">No city rules yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
