import { useState } from "react";
import { useListStaff, getListStaffQueryKey, useCreateStaff, useListBranches, getListBranchesQueryKey, type CreateStaffBody } from "@workspace/api-client-react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Plus, Star, UserCog } from "lucide-react";
import { Link } from "wouter";
import { Can } from "@/components/Can";
import { PageHeader, EmptyState } from "@/components/shared";

type StaffForm = { name: string; phone: string; email: string; role: string; branchId: string; monthlySalary: string };

export default function AdminStaff() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<StaffForm>({ name: "", phone: "", email: "", role: "technician", branchId: "", monthlySalary: "" });

  const { data: staff, isLoading } = useListStaff({}, { query: { queryKey: getListStaffQueryKey({}) } });
  const { data: branches } = useListBranches({ query: { queryKey: getListBranchesQueryKey() } });

  const createMutation = useCreateStaff({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListStaffQueryKey() });
        setOpen(false);
        toast({ title: "Staff member created" });
      },
      onError: () => toast({ title: "Failed to create staff", variant: "destructive" }),
    },
  });

  const list = staff ?? [];

  return (
    <AdminLayout>
      <div className="p-6 space-y-5">
        <PageHeader
          title="Staff"
          description={`${list.length} team members`}
          actions={
            <Can resource="staff" action="create">
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary text-secondary hover:bg-primary/90" data-testid="btn-add-staff">
                    <Plus size={15} className="mr-1.5" />Add Staff
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New Staff Member</DialogTitle></DialogHeader>
                  <div className="space-y-4 mt-2">
                    {[["name", "Full Name", "text"], ["phone", "Phone", "tel"], ["email", "Email", "email"], ["monthlySalary", "Monthly Salary (₹)", "number"]].map(([k, l, t]) => (
                      <div key={k}>
                        <Label htmlFor={k}>{l}</Label>
                        <Input id={k} data-testid={`input-staff-${k}`} type={t} value={form[k as keyof StaffForm]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} className="mt-1" />
                      </div>
                    ))}
                    <div>
                      <Label>Role</Label>
                      <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                        <SelectTrigger className="mt-1" data-testid="select-staff-role"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["technician", "supervisor", "driver", "solar_technician"].map(r => (
                            <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Branch</Label>
                      <Select value={form.branchId} onValueChange={v => setForm(f => ({ ...f, branchId: v }))}>
                        <SelectTrigger className="mt-1" data-testid="select-staff-branch"><SelectValue placeholder="Select branch" /></SelectTrigger>
                        <SelectContent>
                          {(branches ?? []).map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={() => {
                        const payload: CreateStaffBody = {
                          name: form.name,
                          phone: form.phone,
                          email: form.email || undefined,
                          role: form.role as CreateStaffBody["role"],
                          branchId: parseInt(form.branchId),
                          monthlySalary: form.monthlySalary ? Number(form.monthlySalary) : undefined,
                        };
                        createMutation.mutate({ data: payload });
                      }}
                      disabled={createMutation.isPending || !form.branchId}
                      className="w-full bg-primary text-secondary hover:bg-primary/90"
                      data-testid="btn-submit-staff">
                      {createMutation.isPending ? "Creating..." : "Create Staff Member"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </Can>
          }
        />

        {isLoading ? (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
          </div>
        ) : list.length === 0 ? (
          <EmptyState title="No staff yet" description="Add your first team member to start scheduling jobs." />
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {list.map(s => (
              <div key={s.id} className="bg-white/[0.02] border border-white/10 rounded-xl p-4 hover:border-primary/30 transition-colors" data-testid={`staff-card-${s.id}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <UserCog size={16} className="text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-white">{s.name}</p>
                      <p className="text-xs text-white/50 capitalize">{s.role?.replace(/_/g, " ")}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={s.isActive ? "text-green-400 border-green-500/20 bg-green-500/10 text-xs" : "text-xs"}>
                    {s.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="space-y-1.5 text-xs text-white/50 mb-3">
                  <p>{s.phone}</p>
                  <p>{s.branchName}</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="flex items-center gap-1">
                      <Star size={11} className="text-primary" fill="currentColor" />
                      {Number(s.rating ?? 0).toFixed(1)} rating
                    </span>
                    <span>{s.jobsCompletedThisMonth ?? 0} jobs this month</span>
                  </div>
                </div>
                <Link href={`/admin/staff/${s.id}`} className="text-primary hover:underline text-xs font-medium" data-testid={`btn-view-staff-${s.id}`}>View Details →</Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
