import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useCatalogAddons, useCatalogMutations } from "@/features/service-catalog/api";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

export function AddonsTab() {
  const { toast } = useToast();
  const { data: addons } = useCatalogAddons();
  const mutations = useCatalogMutations("addons");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", basePrice: "", description: "" });

  const create = () => {
    mutations.create.mutate({
      name: form.name,
      basePrice: form.basePrice,
      description: form.description || undefined,
      pricingType: "inclusive",
      gstRate: "18",
      isActive: true,
    }, {
      onSuccess: () => { setOpen(false); toast({ title: "Addon created" }); },
      onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus size={14} className="mr-1" />Add Addon</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Addon</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1" /></div>
              <div><Label>Price (₹)</Label><Input type="number" value={form.basePrice} onChange={e => setForm(f => ({ ...f, basePrice: e.target.value }))} className="mt-1" /></div>
              <div><Label>Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="mt-1" /></div>
              <Button onClick={create} disabled={!form.name || !form.basePrice} className="w-full">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {(addons ?? []).map(addon => (
          <Card key={addon.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{addon.name}</CardTitle>
              <CardDescription>{addon.description ?? addon.slug}</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-between">
              <span className="font-semibold">₹{addon.basePrice}</span>
              <Badge variant={addon.isActive ? "default" : "secondary"}>{addon.isActive ? "Active" : "Off"}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
