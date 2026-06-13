import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { commApi, type CommBrand } from "../api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

export default function BrandsPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: brands } = useQuery({ queryKey: ["comm-brands"], queryFn: commApi.getBrands });
  const [form, setForm] = useState({ name: "", code: "", primaryColor: "#1e40af" });

  const createMut = useMutation({
    mutationFn: () => commApi.createBrand({ ...form, status: "active" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comm-brands"] });
      setForm({ name: "", code: "", primaryColor: "#1e40af" });
      toast({ title: "Brand created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Multi-Brand Registry</CardTitle>
          <CardDescription>CWP Detailers, Kleansolar, DCC, BidWar — isolated communication per brand</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3">
          {(brands ?? []).map((b: CommBrand) => (
            <div key={b.id} className="p-4 border rounded-lg flex items-center gap-3">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ background: b.primaryColor ?? "#666" }} />
              <div className="flex-1 min-w-0">
                <p className="font-medium">{b.name}</p>
                <p className="text-xs text-muted-foreground">{b.code} · {b.status}</p>
              </div>
              <Badge variant="outline">{b.code}</Badge>
            </div>
          ))}
          {!brands?.length && <p className="text-sm text-muted-foreground col-span-2 text-center py-6">No brands yet</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Add Brand</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-3">
          <Input placeholder="Brand name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <Input placeholder="Code (e.g. cwp)" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
          <Input type="color" value={form.primaryColor} onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))} />
          <Button onClick={() => createMut.mutate()} disabled={!form.name || !form.code || createMut.isPending} className="md:col-span-3">
            <Plus size={14} className="mr-1.5" />Create Brand
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
