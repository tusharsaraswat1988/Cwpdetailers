import { useState } from "react";
import { useListServices, getListServicesQueryKey, useCreateService, useDeleteService } from "@workspace/api-client-react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Plus, Wrench, Trash2 } from "lucide-react";

const categories = ["car_wash", "detailing", "ceramic_coating", "ppf", "interior", "solar_cleaning", "amc", "subscription"];

export default function AdminServices() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", category: "car_wash", basePrice: "", durationMinutes: "" });

  const { data: services, isLoading } = useListServices({}, { query: { queryKey: getListServicesQueryKey({}) } });

  const createMutation = useCreateService({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListServicesQueryKey() });
        setOpen(false);
        toast({ title: "Service created" });
      },
    },
  });

  const deleteMutation = useDeleteService({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListServicesQueryKey() });
        toast({ title: "Service deleted" });
      },
    },
  });

  return (
    <AdminLayout>
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl">Services</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{(services ?? []).length} services in catalog</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-secondary hover:bg-primary/90" data-testid="btn-add-service">
                <Plus size={15} className="mr-1.5" />Add Service
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Service</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                {[["name", "Service Name", "text"], ["description", "Description", "text"], ["basePrice", "Base Price (₹)", "number"], ["durationMinutes", "Duration (minutes)", "number"]].map(([k, l, t]) => (
                  <div key={k}>
                    <Label>{l}</Label>
                    <Input data-testid={`input-service-${k}`} type={t} value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} className="mt-1" />
                  </div>
                ))}
                <div>
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger className="mt-1" data-testid="select-service-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => createMutation.mutate({ data: { ...form, basePrice: parseFloat(form.basePrice), durationMinutes: form.durationMinutes ? parseInt(form.durationMinutes) : undefined } as any })}
                  disabled={createMutation.isPending} className="w-full bg-primary text-secondary hover:bg-primary/90" data-testid="btn-submit-service">
                  {createMutation.isPending ? "Creating..." : "Create Service"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {isLoading ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />) :
            (services ?? []).map(s => (
              <div key={s.id} className="bg-card border border-border rounded-xl p-4 group" data-testid={`service-card-${s.id}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Wrench size={14} className="text-primary" />
                  </div>
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive h-7 w-7 p-0 opacity-0 group-hover:opacity-100"
                    data-testid={`btn-delete-service-${s.id}`}
                    onClick={() => deleteMutation.mutate({ id: s.id })}>
                    <Trash2 size={13} />
                  </Button>
                </div>
                <h3 className="font-semibold text-sm">{s.name}</h3>
                <p className="text-muted-foreground text-xs mt-1 line-clamp-2">{s.description}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="font-display font-bold text-primary">₹{Number(s.basePrice).toLocaleString("en-IN")}</span>
                  <Badge variant="outline" className="text-xs capitalize">{s.category?.replace(/_/g, " ")}</Badge>
                </div>
              </div>
            ))}
        </div>
      </div>
    </AdminLayout>
  );
}
