import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListServices } from "@workspace/api-client-react";
import { useSolarSlabs, useCatalogMutations } from "@/features/service-catalog/api";
import { useToast } from "@/hooks/use-toast";

export function SolarSlabsTab() {
  const { toast } = useToast();
  const { data: services } = useListServices({});
  const solarServices = (services ?? []).filter(s => s.category === "solar_cleaning");
  const [serviceId, setServiceId] = useState(String(solarServices[0]?.id ?? ""));
  const { data: slabs } = useSolarSlabs(serviceId ? parseInt(serviceId) : undefined);
  const mutations = useCatalogMutations("solar-slabs");
  const [form, setForm] = useState({ minPanels: "1", maxPanels: "", pricePerPanel: "60", minimumBilling: "800" });

  const create = () => {
    mutations.create.mutate({
      serviceId: parseInt(serviceId),
      minPanels: parseInt(form.minPanels),
      maxPanels: form.maxPanels ? parseInt(form.maxPanels) : null,
      pricePerPanel: form.pricePerPanel,
      minimumBilling: form.minimumBilling,
      isActive: true,
    }, {
      onSuccess: () => toast({ title: "Solar slab saved" }),
      onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Add Solar Slab</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Service</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {solarServices.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Min panels</Label><Input value={form.minPanels} onChange={e => setForm(f => ({ ...f, minPanels: e.target.value }))} className="mt-1" /></div>
            <div><Label>Max panels</Label><Input value={form.maxPanels} onChange={e => setForm(f => ({ ...f, maxPanels: e.target.value }))} className="mt-1" placeholder="∞" /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>₹/panel</Label><Input value={form.pricePerPanel} onChange={e => setForm(f => ({ ...f, pricePerPanel: e.target.value }))} className="mt-1" /></div>
            <div><Label>Min billing</Label><Input value={form.minimumBilling} onChange={e => setForm(f => ({ ...f, minimumBilling: e.target.value }))} className="mt-1" /></div>
          </div>
          <Button onClick={create} disabled={!serviceId} className="w-full">Save Slab</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Configured Slabs</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(slabs ?? []).map(slab => (
            <div key={slab.id} className="p-3 border rounded flex flex-wrap gap-3 items-center text-sm">
              <span>{slab.minPanels}–{slab.maxPanels ?? "∞"} panels</span>
              <span>₹{slab.pricePerPanel}/panel</span>
              <span>min ₹{slab.minimumBilling}</span>
              <Badge variant="outline">#{slab.serviceId}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
