import { useState } from "react";
import {
  useListBranches,
  getListBranchesQueryKey,
  useCreateBranch,
  useUpdateBranch,
  type Branch,
} from "@workspace/api-client-react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Plus, MapPin, Users, UserCog, MoreHorizontal, Pencil, Trash2, Power } from "lucide-react";
import { PhoneInput } from "@/components/ui/phone-input";
import { submitContactPhone } from "@/lib/contactForm";

type BranchForm = {
  name: string;
  city: string;
  address: string;
  phone: string;
  managerName: string;
  isActive: boolean;
};

const emptyForm = (): BranchForm => ({
  name: "",
  city: "",
  address: "",
  phone: "",
  managerName: "",
  isActive: true,
});

function branchToForm(branch: Branch): BranchForm {
  return {
    name: branch.name,
    city: branch.city,
    address: branch.address ?? "",
    phone: branch.phone ?? "",
    managerName: branch.managerName ?? "",
    isActive: branch.isActive ?? true,
  };
}

async function deleteBranch(id: number) {
  const res = await fetch(`/api/branches/${id}`, { method: "DELETE", credentials: "include" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error ?? "Failed to delete branch") as Error & {
      customerCount?: number;
      staffCount?: number;
    };
    err.customerCount = body.customerCount;
    err.staffCount = body.staffCount;
    throw err;
  }
  return body;
}

function BranchFormFields({
  form,
  setForm,
  phoneError,
  setPhoneError,
  showActiveToggle,
}: {
  form: BranchForm;
  setForm: React.Dispatch<React.SetStateAction<BranchForm>>;
  phoneError: string | null;
  setPhoneError: (v: string | null) => void;
  showActiveToggle?: boolean;
}) {
  return (
    <div className="space-y-4 mt-2">
      {[["name", "Branch Name"], ["city", "City"], ["address", "Address"], ["managerName", "Manager Name"]].map(([k, l]) => (
        <div key={k}>
          <Label>{l}</Label>
          <Input
            data-testid={`input-branch-${k}`}
            value={form[k as keyof BranchForm] as string}
            onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
            className="mt-1"
          />
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
      {showActiveToggle && (
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
          <div>
            <Label htmlFor="branch-active" className="text-sm">Active branch</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Inactive branches are hidden from new assignments</p>
          </div>
          <Switch
            id="branch-active"
            data-testid="switch-branch-active"
            checked={form.isActive}
            onCheckedChange={checked => setForm(f => ({ ...f, isActive: checked }))}
          />
        </div>
      )}
    </div>
  );
}

export default function AdminBranches() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [createForm, setCreateForm] = useState<BranchForm>(emptyForm);
  const [editForm, setEditForm] = useState<BranchForm>(emptyForm);
  const [createPhoneError, setCreatePhoneError] = useState<string | null>(null);
  const [editPhoneError, setEditPhoneError] = useState<string | null>(null);

  const { data: branches, isLoading } = useListBranches({ query: { queryKey: getListBranchesQueryKey() } });

  const invalidate = () => qc.invalidateQueries({ queryKey: getListBranchesQueryKey() });

  const createMutation = useCreateBranch({
    mutation: {
      onSuccess: () => {
        invalidate();
        setCreateOpen(false);
        setCreateForm(emptyForm());
        toast({ title: "Branch created" });
      },
      onError: (err: any) => toast({ title: "Failed to create branch", description: err?.response?.data?.error, variant: "destructive" }),
    },
  });

  const updateMutation = useUpdateBranch({
    mutation: {
      onSuccess: () => {
        invalidate();
        setEditingBranch(null);
        toast({ title: "Branch updated" });
      },
      onError: (err: any) => toast({ title: "Failed to update branch", description: err?.response?.data?.error, variant: "destructive" }),
    },
  });

  const buildPayload = (form: BranchForm) => {
    const phoneResult = submitContactPhone(form.phone);
    return { phoneResult, payload: {
      name: form.name.trim(),
      city: form.city.trim(),
      address: form.address.trim() || undefined,
      phone: phoneResult.ok ? phoneResult.value : undefined,
      managerName: form.managerName.trim() || undefined,
    } };
  };

  const handleCreate = () => {
    const { phoneResult, payload } = buildPayload(createForm);
    setCreatePhoneError(phoneResult.ok ? null : phoneResult.error);
    if (!payload.name || !payload.city) {
      toast({ title: "Branch name and city are required", variant: "destructive" });
      return;
    }
    if (!phoneResult.ok) {
      toast({ title: phoneResult.error, variant: "destructive" });
      return;
    }
    createMutation.mutate({ data: payload });
  };

  const handleUpdate = () => {
    if (!editingBranch) return;
    const { phoneResult, payload } = buildPayload(editForm);
    setEditPhoneError(phoneResult.ok ? null : phoneResult.error);
    if (!payload.name || !payload.city) {
      toast({ title: "Branch name and city are required", variant: "destructive" });
      return;
    }
    if (!phoneResult.ok) {
      toast({ title: phoneResult.error, variant: "destructive" });
      return;
    }
    updateMutation.mutate({
      id: editingBranch.id,
      data: { ...payload, isActive: editForm.isActive } as any,
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteBranch(deleteTarget.id);
      invalidate();
      toast({ title: "Branch deleted", description: `${deleteTarget.name} has been removed.` });
      setDeleteTarget(null);
    } catch (err: any) {
      const hasLinked = (err.customerCount ?? 0) > 0 || (err.staffCount ?? 0) > 0;
      toast({
        title: hasLinked ? "Cannot delete branch" : "Delete failed",
        description: err.message,
        variant: "destructive",
      });
      if (hasLinked) setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const openEdit = (branch: Branch) => {
    setEditForm(branchToForm(branch));
    setEditPhoneError(null);
    setEditingBranch(branch);
  };

  const toggleActive = (branch: Branch) => {
    updateMutation.mutate({
      id: branch.id,
      data: {
        name: branch.name,
        city: branch.city,
        address: branch.address,
        phone: branch.phone,
        managerName: branch.managerName,
        isActive: !branch.isActive,
      } as any,
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
          <Dialog open={createOpen} onOpenChange={open => { setCreateOpen(open); if (!open) { setCreateForm(emptyForm()); setCreatePhoneError(null); } }}>
            <DialogTrigger asChild>
              <Button data-testid="btn-add-branch">
                <Plus size={15} className="mr-1.5" />Add Branch
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Branch</DialogTitle></DialogHeader>
              <BranchFormFields form={createForm} setForm={setCreateForm} phoneError={createPhoneError} setPhoneError={setCreatePhoneError} />
              <Button onClick={handleCreate} disabled={createMutation.isPending} className="w-full  mt-4" data-testid="btn-submit-branch">
                {createMutation.isPending ? "Creating..." : "Create Branch"}
              </Button>
            </DialogContent>
          </Dialog>
        </div>

        <Dialog open={!!editingBranch} onOpenChange={open => { if (!open) setEditingBranch(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Branch</DialogTitle></DialogHeader>
            <BranchFormFields form={editForm} setForm={setEditForm} phoneError={editPhoneError} setPhoneError={setEditPhoneError} showActiveToggle />
            <Button onClick={handleUpdate} disabled={updateMutation.isPending} className="w-full  mt-4" data-testid="btn-save-branch">
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes the branch record. Branches with assigned customers or staff cannot be deleted — deactivate them instead.
                {(deleteTarget?.customerCount ?? 0) > 0 || (deleteTarget?.staffCount ?? 0) > 0 ? (
                  <span className="block mt-2 text-amber-600">
                    This branch has {deleteTarget?.customerCount ?? 0} customer(s) and {deleteTarget?.staffCount ?? 0} staff member(s).
                  </span>
                ) : null}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="btn-confirm-delete-branch"
              >
                {deleting ? "Deleting..." : "Delete Branch"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {isLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 w-full rounded-xl" />) :
            (branches ?? []).map(b => (
              <div key={b.id} className="bg-card border border-border rounded-2xl p-5" data-testid={`branch-card-${b.id}`}>
                <div className="flex items-start justify-between mb-3 gap-2">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin size={18} className="text-primary" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${b.isActive ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"}`}>
                      {b.isActive ? "Active" : "Inactive"}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`btn-branch-menu-${b.id}`}>
                          <MoreHorizontal size={16} />
                          <span className="sr-only">Branch actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(b)} data-testid={`btn-edit-branch-${b.id}`}>
                          <Pencil size={14} className="mr-2" />Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleActive(b)} data-testid={`btn-toggle-branch-${b.id}`}>
                          <Power size={14} className="mr-2" />
                          {b.isActive ? "Deactivate" : "Activate"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteTarget(b)}
                          data-testid={`btn-delete-branch-${b.id}`}
                        >
                          <Trash2 size={14} className="mr-2" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <h3 className="font-semibold text-base">{b.name}</h3>
                <p className="text-muted-foreground text-sm">{b.city}</p>
                {b.address && <p className="text-xs text-muted-foreground mt-1">{b.address}</p>}
                {b.managerName && <p className="text-xs text-muted-foreground">Manager: {b.managerName}</p>}
                {b.phone && <p className="text-xs text-muted-foreground">Phone: {b.phone}</p>}
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
