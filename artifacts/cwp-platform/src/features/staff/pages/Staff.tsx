import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getListStaffQueryKey, useListBranches, getListBranchesQueryKey } from "@workspace/api-client-react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Plus, Star, UserCog } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import { Can } from "@/components/Can";
import { PageHeader, EmptyState } from "@/components/shared";
import { PhoneInput } from "@/components/ui/phone-input";
import { EmailInput } from "@/components/ui/email-input";
import { submitEmail, submitMobile } from "@/lib/contactForm";
import { staffEcosystemApi, STAFF_ECOSYSTEM_QUERY_KEY, STAFF_CATEGORY_OPTIONS, type RoleMaster, type StaffCategory } from "@/lib/staff-ecosystem/api";

type StaffForm = {
  name: string;
  phone: string;
  email: string;
  staffCategory: StaffCategory;
  operationalRoleId: string;
  reportingManagerId: string;
  branchId: string;
  monthlySalary: string;
  initialPassword: string;
};

type StaffListRow = {
  id: number;
  userId?: number | null;
  name: string;
  phone?: string;
  branchName?: string;
  isActive?: boolean;
  rating?: number;
  jobsCompletedThisMonth?: number;
  employeeCode?: string;
  profilePhotoUrl?: string;
  profileCompletionPercent?: number;
  staffCategory?: StaffCategory;
  role?: string;
  operationalRoles?: Array<{ roleName: string; roleSlug: string }>;
};

function resolveStaffCategory(row: Pick<StaffListRow, "staffCategory" | "role">): StaffCategory {
  if (row.staffCategory === "supervisor" || row.staffCategory === "cleaning_staff") {
    return row.staffCategory;
  }
  if (row.role === "supervisor") return "supervisor";
  return "cleaning_staff";
}

function staffCategoryLabel(category: StaffCategory) {
  return category === "supervisor" ? "Supervisor" : "Cleaning Staff";
}

function staffCategoryHeaderStyles(category: StaffCategory) {
  if (category === "supervisor") {
    return "bg-violet-600 text-white border-violet-700";
  }
  return "bg-sky-600 text-white border-sky-700";
}

export default function AdminStaff() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<StaffForm>({
    name: "", phone: "", email: "", staffCategory: "cleaning_staff",
    operationalRoleId: "", reportingManagerId: "", branchId: "", monthlySalary: "", initialPassword: "staff123",
  });
  const [errors, setErrors] = useState<{ phone?: string | null; email?: string | null }>({});

  const [categoryFilter, setCategoryFilter] = useState<"" | StaffCategory>("");

  const { data: staff, isLoading } = useQuery({
    queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, "admin-list"],
    queryFn: async () => {
      const res = await fetch("/api/staff", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load staff");
      return res.json() as Promise<StaffListRow[]>;
    },
  });
  const { data: branches } = useListBranches({ query: { queryKey: getListBranchesQueryKey() } });
  const { data: roleMaster } = useQuery({
    queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, "roles"],
    queryFn: staffEcosystemApi.getRoleMaster,
  });
  const { data: supervisors } = useQuery({
    queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, "supervisors"],
    queryFn: staffEcosystemApi.listSupervisors,
    enabled: open && form.staffCategory === "cleaning_staff",
  });

  const createMutation = useMutation({
    mutationFn: async (payload: {
      name: string;
      phone: string;
      email: string;
      staffCategory: StaffCategory;
      branchId: number;
      monthlySalary?: number;
      operationalRoleIds?: number[];
      reportingManagerId?: number;
      initialPassword: string;
    }) => {
      const res = await fetch("/api/staff", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to create staff");
      }
      return res.json();
    },
    onSuccess: (data: { loginCreated?: boolean; loginWarning?: string; phone?: string }) => {
      qc.invalidateQueries({ queryKey: getListStaffQueryKey() });
      qc.invalidateQueries({ queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, "admin-list"] });
      qc.invalidateQueries({ queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, "list"] });
      setOpen(false);
      setForm({
        name: "", phone: "", email: "", staffCategory: "cleaning_staff",
        operationalRoleId: "", reportingManagerId: "", branchId: "", monthlySalary: "", initialPassword: "staff123",
      });
      if (data.loginWarning) {
        toast({ title: "Staff saved — login not created", description: data.loginWarning, variant: "destructive" });
      } else if (data.loginCreated) {
        toast({ title: "Staff member created", description: `Login ready: ${data.phone} / password set` });
      } else {
        toast({ title: "Staff member created" });
      }
    },
    onError: (err: Error) => toast({ title: "Failed to create staff", description: err.message, variant: "destructive" }),
  });

  const handleCreate = () => {
    const phoneResult = submitMobile(form.phone);
    const emailResult = submitEmail(form.email);
    setErrors({
      phone: phoneResult.ok ? null : phoneResult.error,
      email: emailResult.ok ? null : emailResult.error,
    });
    if (!phoneResult.ok || !emailResult.ok) {
      toast({ title: "Please fix phone or email format", variant: "destructive" });
      return;
    }
    if (form.staffCategory === "cleaning_staff" && !form.operationalRoleId) {
      toast({ title: "Select an operational role", variant: "destructive" });
      return;
    }
    if (form.initialPassword.length < 6) {
      toast({ title: "Portal password must be at least 6 characters", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      name: form.name,
      phone: phoneResult.value,
      email: emailResult.value ?? "",
      staffCategory: form.staffCategory,
      branchId: parseInt(form.branchId),
      monthlySalary: form.monthlySalary ? Number(form.monthlySalary) : undefined,
      operationalRoleIds: form.staffCategory === "cleaning_staff" ? [parseInt(form.operationalRoleId, 10)] : undefined,
      reportingManagerId: form.staffCategory === "cleaning_staff" && form.reportingManagerId
        ? parseInt(form.reportingManagerId, 10)
        : undefined,
      initialPassword: form.initialPassword,
    });
  };

  const isCleaningStaff = form.staffCategory === "cleaning_staff";
  const canSubmit = Boolean(form.branchId) && (form.staffCategory === "supervisor" || form.operationalRoleId);

  const allStaff = useMemo(
    () => (staff ?? []).map(row => ({ ...row, staffCategory: resolveStaffCategory(row) })),
    [staff],
  );

  const list = useMemo(() => {
    if (!categoryFilter) return allStaff;
    return allStaff.filter(s => s.staffCategory === categoryFilter);
  }, [allStaff, categoryFilter]);

  const filterDescription = categoryFilter
    ? `${list.length} ${staffCategoryLabel(categoryFilter).toLowerCase()}`
    : `${list.length} team members`;

  const categoryCounts = useMemo(() => ({
    all: allStaff.length,
    cleaning_staff: allStaff.filter(s => s.staffCategory === "cleaning_staff").length,
    supervisor: allStaff.filter(s => s.staffCategory === "supervisor").length,
  }), [allStaff]);

  return (
    <AdminLayout>
      <div className="p-6 space-y-5">
        <PageHeader
          title="Staff"
          description={filterDescription}
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
                    <div>
                      <Label htmlFor="name">Full Name</Label>
                      <Input id="name" data-testid="input-staff-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1" />
                    </div>
                    <PhoneInput
                      id="phone"
                      data-testid="input-staff-phone"
                      label="Phone"
                      value={form.phone}
                      onChange={v => setForm(f => ({ ...f, phone: v }))}
                      error={errors.phone}
                      onErrorChange={err => setErrors(e => ({ ...e, phone: err }))}
                    />
                    <EmailInput
                      id="email"
                      data-testid="input-staff-email"
                      label="Email"
                      optional
                      value={form.email}
                      onChange={v => setForm(f => ({ ...f, email: v }))}
                      error={errors.email}
                      onErrorChange={err => setErrors(e => ({ ...e, email: err }))}
                    />
                    <div>
                      <Label htmlFor="monthlySalary">Monthly Salary (₹)</Label>
                      <Input id="monthlySalary" data-testid="input-staff-monthlySalary" type="number" value={form.monthlySalary} onChange={e => setForm(f => ({ ...f, monthlySalary: e.target.value }))} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="initialPassword">Portal Login Password</Label>
                      <Input
                        id="initialPassword"
                        type="password"
                        data-testid="input-staff-password"
                        value={form.initialPassword}
                        onChange={e => setForm(f => ({ ...f, initialPassword: e.target.value }))}
                        className="mt-1"
                        placeholder="Min 6 characters"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Staff will sign in at /login with their phone number and this password.
                      </p>
                    </div>
                    <div>
                      <Label>Staff Category</Label>
                      <Select
                        value={form.staffCategory}
                        onValueChange={v => setForm(f => ({
                          ...f,
                          staffCategory: v as StaffCategory,
                          operationalRoleId: v === "supervisor" ? "" : f.operationalRoleId,
                          reportingManagerId: v === "supervisor" ? "" : f.reportingManagerId,
                        }))}
                      >
                        <SelectTrigger className="mt-1" data-testid="select-staff-category"><SelectValue placeholder="Select category" /></SelectTrigger>
                        <SelectContent>
                          {STAFF_CATEGORY_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Cleaning staff use field roles and report to a supervisor. Supervisor roles will be configured later.
                      </p>
                    </div>
                    {isCleaningStaff && (
                      <>
                        <div>
                          <Label>Operational Role</Label>
                          <Select value={form.operationalRoleId} onValueChange={v => setForm(f => ({ ...f, operationalRoleId: v }))}>
                            <SelectTrigger className="mt-1" data-testid="select-staff-role"><SelectValue placeholder="Select role" /></SelectTrigger>
                            <SelectContent>
                              {(roleMaster ?? []).map((r: RoleMaster) => (
                                <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground mt-1">
                            Roles control DCMS, booking, and field assignments. Add more roles on the staff profile later.
                          </p>
                        </div>
                        <div>
                          <Label>Reporting Manager (Supervisor)</Label>
                          <Select value={form.reportingManagerId} onValueChange={v => setForm(f => ({ ...f, reportingManagerId: v }))}>
                            <SelectTrigger className="mt-1" data-testid="select-reporting-manager"><SelectValue placeholder="Select supervisor" /></SelectTrigger>
                            <SelectContent>
                              {(supervisors ?? []).map(s => (
                                <SelectItem key={s.id} value={String(s.id)}>{s.name}{s.employeeCode ? ` (${s.employeeCode})` : ""}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
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
                      onClick={handleCreate}
                      disabled={createMutation.isPending || !canSubmit}
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

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={categoryFilter === "" ? "default" : "outline"}
            onClick={() => setCategoryFilter("")}
          >
            All ({categoryCounts.all})
          </Button>
          {STAFF_CATEGORY_OPTIONS.map(opt => (
            <Button
              key={opt.value}
              size="sm"
              variant={categoryFilter === opt.value ? "default" : "outline"}
              onClick={() => setCategoryFilter(opt.value)}
            >
              {opt.label} ({categoryCounts[opt.value]})
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            title={categoryFilter ? `No ${staffCategoryLabel(categoryFilter).toLowerCase()} found` : "No staff yet"}
            description={categoryFilter ? "Try another category or add a new staff member." : "Add your first team member to start scheduling jobs."}
          />
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {list.map(s => {
              const category = s.staffCategory!;
              return (
              <div key={s.id} className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/30 transition-colors" data-testid={`staff-card-${s.id}`}>
                <div className={`px-4 py-2.5 border-b text-xs font-semibold tracking-wide uppercase ${staffCategoryHeaderStyles(category)}`}>
                  Staff Category · {staffCategoryLabel(category)}
                </div>
                <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {(s as { profilePhotoUrl?: string }).profilePhotoUrl ? (
                      <img src={(s as { profilePhotoUrl?: string }).profilePhotoUrl!} alt="" className="w-10 h-10 rounded-xl object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <UserCog size={16} className="text-primary" />
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-sm text-foreground">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.employeeCode ?? `ID ${s.id}`}</p>
                      {(s.operationalRoles?.length ?? 0) > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {s.operationalRoles!.map(r => (
                            <Badge key={r.roleSlug} variant="secondary" className="text-[10px] font-normal">
                              {r.roleName}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className={s.isActive ? "text-green-600 dark:text-green-400 border-green-500/20 bg-green-500/10 text-xs" : "text-xs text-muted-foreground"}>
                    {s.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                {!s.userId && (
                  <p className="text-xs text-amber-600 mb-2">No portal login — open profile to create</p>
                )}
                <div className="space-y-1.5 text-xs text-muted-foreground mb-3">
                  <p>{s.phone}</p>
                  <p>{s.branchName}</p>
                  <div className="pt-1">
                    <div className="flex justify-between mb-1">
                      <span>Profile</span>
                      <span>{(s as { profileCompletionPercent?: number }).profileCompletionPercent ?? 0}%</span>
                    </div>
                    <Progress value={(s as { profileCompletionPercent?: number }).profileCompletionPercent ?? 0} className="h-1.5" />
                  </div>
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
              </div>
            );})}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
