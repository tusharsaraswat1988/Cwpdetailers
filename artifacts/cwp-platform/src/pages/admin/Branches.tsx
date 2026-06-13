import { useState } from "react";
import { useListBranches, getListBranchesQueryKey, useCreateBranch } from "@workspace/api-client-react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Plus, MapPin, Users, UserCog } from "lucide-react";
import { PhoneInput } from "@/components/ui/phone-input";
import { submitContactPhone } from "@/lib/contactForm";

export default function AdminBranches() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", city: "", address: "", phone: "", managerName: "" });
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const { data: branches, isLoading } = useListBranches({ query: { queryKey: getListBranchesQueryKey() } });

  const createMutation = useCreateBranch({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListBranchesQueryKey() });
        setOpen(false);
        toast({ title: "Branch created" });
      },
      onError: (err: any) => toast({ title: "Failed to create branch", description: err?.response?.data?.error, variant: "destructive" }),
    },
  });

  const handleCreate = () => {
    const phoneResult = submitContactPhone(form.phone);
    setPhoneError(phoneResult.ok ? null : phoneResult.error);
    if (!phoneResult.ok) {
      toast({ title: phoneResult.error, variant: "destructive" });
      return;
    }
    createMutation.mutate({
      data: {
        ...form,
        phone: phoneResult.value,
      },
    });
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl">Branches</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{(branches ?? []).length} locations</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-secondary hover:bg-primary/90" data-testid="btn-add-branch">
                <Plus size={15} className="mr-1.5" />Add Branch
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Branch</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                {[["name", "Branch Name"], ["city", "City"], ["address", "Address"], ["managerName", "Manager Name"]].map(([k, l]) => (
                  <div key={k}>
                    <Label>{l}</Label>
                    <Input data-testid={`input-branch-${k}`} value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} className="mt-1" />
                  </div>
                ))}
                <PhoneInput
                  data-testid="input-branch-phone"
                  label="Phone"
                  mode="contact"
                  optional
                  value={form.phone}
                  onChange={v => setForm(f => ({ ...f, phone: v }))}
                  error={phoneError}
                  onErrorChange={setPhoneError}
                />
                <Button onClick={handleCreate} disabled={createMutation.isPending} className="w-full bg-primary text-secondary hover:bg-primary/90" data-testid="btn-submit-branch">
                  {createMutation.isPending ? "Creating..." : "Create Branch"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {isLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 w-full rounded-xl" />) :
            (branches ?? []).map(b => (
              <div key={b.id} className="bg-card border border-border rounded-2xl p-5" data-testid={`branch-card-${b.id}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <MapPin size={18} className="text-primary" />
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${b.isActive ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"}`}>
                    {b.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <h3 className="font-semibold text-base">{b.name}</h3>
                <p className="text-muted-foreground text-sm">{b.city}</p>
                {b.address && <p className="text-xs text-muted-foreground mt-1">{b.address}</p>}
                {b.managerName && <p className="text-xs text-muted-foreground">Manager: {b.managerName}</p>}
                <div className="flex gap-4 mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Users size={11} />
                    <span>{b.customerCount ?? 0} customers</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <UserCog size={11} />
                    <span>{b.staffCount ?? 0} staff</span>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </AdminLayout>
  );
}
