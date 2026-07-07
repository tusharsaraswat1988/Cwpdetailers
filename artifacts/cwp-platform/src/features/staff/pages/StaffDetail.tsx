import { useRef, useState } from "react";
import { useRoute, Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRequestUploadUrl, getListStaffQueryKey } from "@workspace/api-client-react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useBranding } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { uploadFileToCloudinary } from "@/lib/media-url";
import { resolveMediaUrl } from "@/lib/media-url";
import {
  staffEcosystemApi, STAFF_ECOSYSTEM_QUERY_KEY, DOC_LABELS, OPTIONAL_DOCS, STAFF_CATEGORY_OPTIONS,
  type StaffEcosystemProfile, type StaffDocument,
} from "@/lib/staff-ecosystem/api";
import {
  ArrowLeft, CheckCircle2, Circle, Download, Eye, Printer, Upload, User, Star, Briefcase, Key, MapPin, Bell,
} from "lucide-react";
import { StaffLocationHistory } from "@/features/staff/components/StaffLocationHistory";

function ProfileCompletionBar({ p }: { p: StaffEcosystemProfile["profileCompletion"] }) {
  const items = [
    { label: "Identity", ok: p.identityComplete },
    { label: "Documents", ok: p.documentsComplete },
    { label: "Bank", ok: p.bankComplete },
    { label: "Address", ok: p.addressComplete },
  ];
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Profile {p.percent}%</span>
      </div>
      <Progress value={p.percent} className="h-2" />
      <div className="flex flex-wrap gap-3 text-xs">
        {items.map(i => (
          <span key={i.label} className={`flex items-center gap-1 ${i.ok ? "text-green-600" : "text-muted-foreground"}`}>
            {i.ok ? <CheckCircle2 size={12} /> : <Circle size={12} />}
            {i.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function DocumentCard({
  label, doc, onUpload, onView,
}: {
  label: string;
  doc?: StaffDocument;
  onUpload: (file: File, meta?: { documentNumber?: string; expiryDate?: string }) => void;
  onView: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <Card className={doc ? "" : "border-dashed"}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          {label}
          {doc?.isExpired && <Badge variant="destructive" className="text-[10px]">Expired</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        {doc ? (
          <>
            {doc.documentNumber && <p className="text-muted-foreground">#{doc.documentNumber}</p>}
            {doc.expiryDate && <p className="text-muted-foreground">Expires {doc.expiryDate}</p>}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => onView(doc.fileUrl)}><Eye size={12} className="mr-1" />View</Button>
              <Button size="sm" variant="outline" asChild>
                <a href={resolveMediaUrl(doc.fileUrl)} download target="_blank" rel="noreferrer"><Download size={12} className="mr-1" />Download</a>
              </Button>
              <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}><Upload size={12} className="mr-1" />Replace</Button>
            </div>
          </>
        ) : (
          <Button size="sm" variant="secondary" className="w-full" onClick={() => inputRef.current?.click()}>
            <Upload size={12} className="mr-1" />Upload
          </Button>
        )}
        <input ref={inputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
      </CardContent>
    </Card>
  );
}

export default function StaffDetail() {
  const branding = useBranding();
  const [, params] = useRoute("/admin/staff/:id");
  const id = parseInt(params?.id ?? "0", 10);
  const qc = useQueryClient();
  const { toast } = useToast();
  const requestUpload = useRequestUploadUrl();
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [draft, setDraft] = useState<Partial<StaffEcosystemProfile>>({});
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginPassword, setLoginPassword] = useState("staff123");

  const { data: profile, isLoading } = useQuery({
    queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, id],
    queryFn: () => staffEcosystemApi.getProfile(id),
    enabled: id > 0,
  });

  const { data: roleMaster } = useQuery({
    queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, "roles"],
    queryFn: staffEcosystemApi.getRoleMaster,
  });

  const { data: supervisors } = useQuery({
    queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, "supervisors"],
    queryFn: staffEcosystemApi.listSupervisors,
  });

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => staffEcosystemApi.patchProfile(id, data),
    onSuccess: (_data, variables) => {
      qc.setQueryData([STAFF_ECOSYSTEM_QUERY_KEY, id], (old: StaffEcosystemProfile | undefined) =>
        old ? { ...old, ...variables } as StaffEcosystemProfile : old,
      );
      setDraft({});
      qc.invalidateQueries({ queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, id] });
      qc.invalidateQueries({ queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, "admin-list"] });
      qc.invalidateQueries({ queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, "supervisors"] });
      qc.invalidateQueries({ queryKey: getListStaffQueryKey() });
      toast({ title: "Saved", description: "Staff profile updated." });
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const rolesMutation = useMutation({
    mutationFn: (roles: { roleId: number; skillLevel: string }[]) => staffEcosystemApi.putRoles(id, roles),
    onSuccess: () => qc.invalidateQueries({ queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, id] }),
  });

  const noteMutation = useMutation({
    mutationFn: (note: string) => staffEcosystemApi.addNote(id, note),
    onSuccess: () => {
      setNoteText("");
      qc.invalidateQueries({ queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, id] });
    },
  });

  const createLoginMutation = useMutation({
    mutationFn: (password: string) => staffEcosystemApi.createLogin(id, password),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, id] });
      setLoginOpen(false);
      toast({ title: "Portal login created", description: `Phone: ${data.phone} — staff can sign in at /staff/login` });
    },
    onError: (e: Error) => toast({ title: "Login creation failed", description: e.message, variant: "destructive" }),
  });

  const testAlertMutation = useMutation({
    mutationFn: () => staffEcosystemApi.sendTestJobAlert(id),
    onSuccess: (data) => {
      const hint = data.hints?.length ? ` ${data.hints[0]}` : "";
      toast({
        title: data.sent > 0 ? "Test alert sent" : data.inApp ? "In-app alert saved" : "Test alert sent",
        description: `${data.message}${hint}`,
        variant: data.ok ? "default" : "destructive",
      });
    },
    onError: (e: Error) =>
      toast({ title: "Test alert failed", description: e.message, variant: "destructive" }),
  });

  const uploadDoc = async (documentType: string, file: File, extra?: Record<string, unknown>) => {
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast({ title: "Invalid file", description: "Use PDF, JPG, PNG, or WEBP", variant: "destructive" });
      return;
    }
    try {
      const presign = await requestUpload.mutateAsync({ data: { name: file.name, size: file.size, contentType: file.type } });
      const url = await uploadFileToCloudinary(file, presign as Parameters<typeof uploadFileToCloudinary>[1]);
      await staffEcosystemApi.uploadDocument(id, { documentType, fileUrl: url, contentType: file.type, fileSizeBytes: file.size, ...extra });
      qc.invalidateQueries({ queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, id] });
      toast({ title: "Document uploaded" });
    } catch (e) {
      toast({ title: "Upload failed", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    }
  };

  const uploadPhoto = async (file: File) => {
    try {
      const presign = await requestUpload.mutateAsync({ data: { name: file.name, size: file.size, contentType: file.type } });
      const url = await uploadFileToCloudinary(file, presign as Parameters<typeof uploadFileToCloudinary>[1]);
      await saveMutation.mutateAsync({ profilePhotoUrl: url });
    } catch (e) {
      toast({ title: "Photo upload failed", variant: "destructive" });
    }
  };

  if (isLoading || !profile) {
    return (
      <AdminLayout>
        <div className="p-6 space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-96 w-full" /></div>
      </AdminLayout>
    );
  }

  const p = { ...profile, ...draft };
  const set = (key: string, value: unknown) => setDraft(d => ({ ...d, [key]: value }));
  const staffCategory = (p.staffCategory ?? "cleaning_staff") as "supervisor" | "cleaning_staff";
  const isCleaningStaff = staffCategory === "cleaning_staff";
  const docMap = Object.fromEntries((profile.documents ?? []).map(d => [d.documentType, d]));
  const bankDoc = docMap.bank_passbook ?? docMap.bank_cancelled_cheque;

  const buildSavePayload = (input: Partial<StaffEcosystemProfile>): Record<string, unknown> => {
    const payload: Record<string, unknown> = { ...input };
    if (payload.staffCategory === "supervisor") {
      payload.reportingManagerId = null;
    }
    return payload;
  };

  const hasDraft = Object.keys(draft).length > 0;
  const handleSave = () => saveMutation.mutate(buildSavePayload(draft));

  const handleCategoryChange = (value: string) => {
    setDraft(d => ({
      ...d,
      staffCategory: value as StaffEcosystemProfile["staffCategory"],
      ...(value === "supervisor" ? { reportingManagerId: null } : {}),
    }));
  };

  const toggleRole = (roleId: number, checked: boolean, skillLevel = "basic") => {
    const current = [...(profile.roles ?? [])];
    const next = checked
      ? [...current.filter(r => r.roleId !== roleId), { roleId, roleName: "", roleSlug: "", skillLevel: skillLevel as StaffEcosystemProfile["roles"][0]["skillLevel"] }]
      : current.filter(r => r.roleId !== roleId);
    rolesMutation.mutate(next.map(r => ({ roleId: r.roleId, skillLevel: r.skillLevel })));
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
        <Link href="/admin/staff" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft size={14} className="mr-1" /> Back to Staff
        </Link>

        <div className="flex flex-col md:flex-row gap-4 md:items-start md:justify-between bg-card border rounded-xl p-4">
          <div className="flex gap-4 items-start">
            <label className="relative cursor-pointer group">
              {p.profilePhotoUrl ? (
                <img src={resolveMediaUrl(p.profilePhotoUrl)} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-primary/20" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center"><User className="text-primary" /></div>
              )}
              <input type="file" className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); }} />
            </label>
            <div>
              <h1 className="text-xl font-bold">{p.name}</h1>
              <p className="text-sm text-muted-foreground">{p.employeeCode ?? `ID ${p.id}`}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant={p.isActive ? "default" : "secondary"}>{p.isActive ? "Active" : "Inactive"}</Badge>
                <Badge variant="outline" className="capitalize">{p.verificationStatus.replace(/_/g, " ")}</Badge>
                <Badge variant="outline" className="capitalize">{p.availability ?? "available"}</Badge>
                <Badge variant="outline">
                  {staffCategory === "supervisor" ? "Supervisor" : "Cleaning Staff"}
                </Badge>
                {profile.userId
                  ? <Badge className="bg-green-500/10 text-green-600 border-green-500/30">Portal Login Active</Badge>
                  : <Badge variant="destructive" className="bg-amber-500/10 text-amber-600 border-amber-500/30">No Portal Login</Badge>}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 w-full md:w-auto md:items-end">
            {!profile.userId && (
              <Button size="sm" variant="outline" onClick={() => { setLoginPassword("staff123"); setLoginOpen(true); }}>
                <Key size={14} className="mr-1.5" />Create Portal Login
              </Button>
            )}
            {profile.userId && (
              <Button
                size="sm"
                variant="outline"
                disabled={testAlertMutation.isPending}
                onClick={() => testAlertMutation.mutate()}
                data-testid="btn-staff-test-job-alert"
              >
                <Bell size={14} className="mr-1.5" />
                {testAlertMutation.isPending ? "Sending…" : "Send test job alert"}
              </Button>
            )}
            <div className="w-full md:w-64"><ProfileCompletionBar p={profile.profileCompletion} /></div>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {isCleaningStaff && <TabsTrigger value="roles">Roles & Skills</TabsTrigger>}
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="banking">Banking</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="location">Location Log</TabsTrigger>
          </TabsList>

          {hasDraft && (
            <div className="sticky top-0 z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
              <p className="text-sm font-medium">Unsaved changes — click Save to apply updates</p>
              <div className="flex gap-2 shrink-0">
                <Button type="button" size="sm" variant="outline" onClick={() => setDraft({})} disabled={saveMutation.isPending}>
                  Discard
                </Button>
                <Button type="button" size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </div>
          )}

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Identity & Status</CardTitle></CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-4">
                <Field label="Full Name"><Input value={p.name} onChange={e => set("name", e.target.value)} /></Field>
                <Field label="Mobile"><Input value={p.phone} onChange={e => set("phone", e.target.value)} /></Field>
                <Field label="Alternate Mobile"><Input value={p.alternatePhone ?? ""} onChange={e => set("alternatePhone", e.target.value)} /></Field>
                <Field label="Email"><Input value={p.email ?? ""} onChange={e => set("email", e.target.value)} /></Field>
                <Field label="Date of Birth"><Input type="date" value={p.dateOfBirth ?? ""} onChange={e => set("dateOfBirth", e.target.value)} /></Field>
                <Field label="Gender">
                  <Select value={p.gender ?? ""} onValueChange={v => set("gender", v)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {["male", "female", "other", "prefer_not_to_say"].map(g => <SelectItem key={g} value={g}>{g.replace(/_/g, " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Date of Joining"><Input type="date" value={p.joiningDate ?? ""} onChange={e => set("joiningDate", e.target.value)} /></Field>
                <Field label="Emergency Contact"><Input value={p.emergencyContactName ?? ""} onChange={e => set("emergencyContactName", e.target.value)} /></Field>
                <Field label="Emergency Phone"><Input value={p.emergencyContactPhone ?? ""} onChange={e => set("emergencyContactPhone", e.target.value)} /></Field>
                <Field label="Active">
                  <Switch checked={p.isActive} onCheckedChange={v => set("isActive", v)} />
                </Field>
                <Field label="Verification">
                  <Select value={p.verificationStatus} onValueChange={v => staffEcosystemApi.setVerificationStatus(id, v).then(() => qc.invalidateQueries({ queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, id] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["pending", "verified", "rejected", "suspended"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Employment & Operations</CardTitle></CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-4">
                <Field label="Role type">
                  <Select value={staffCategory} onValueChange={handleCategoryChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STAFF_CATEGORY_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Employment Type">
                  <Select value={p.employmentType ?? "salaried"} onValueChange={v => set("employmentType", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="salaried">Salaried</SelectItem>
                      <SelectItem value="per_job">Per Job</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {(p.employmentType === "salaried" || p.employmentType === "hybrid" || !p.employmentType) && (
                  <Field label="Monthly Salary (₹)"><Input type="number" value={p.monthlySalary ?? ""} onChange={e => set("monthlySalary", e.target.value)} /></Field>
                )}
                {(p.employmentType === "per_job" || p.employmentType === "hybrid") && (
                  <>
                    <Field label="Per Wash Rate"><Input type="number" value={p.perWashRate ?? ""} onChange={e => set("perWashRate", e.target.value)} /></Field>
                    <Field label="Per Daily Cleaning Visit"><Input type="number" value={p.perDailyCleaningRate ?? ""} onChange={e => set("perDailyCleaningRate", e.target.value)} /></Field>
                    <Field label="Per Solar Panel Rate"><Input type="number" value={p.perSolarPanelRate ?? ""} onChange={e => set("perSolarPanelRate", e.target.value)} /></Field>
                    <Field label="Per Solar AMC Visit"><Input type="number" value={p.perSolarAmcVisitRate ?? ""} onChange={e => set("perSolarAmcVisitRate", e.target.value)} /></Field>
                  </>
                )}
                <Field label="City"><Input value={p.city ?? ""} onChange={e => set("city", e.target.value)} /></Field>
                <Field label="Partner"><Input value={p.partnerName ?? `${branding.brandName} Direct`} disabled /></Field>
                {isCleaningStaff && p.reportingManagerName && !draft.reportingManagerId && (
                  <Field label="Current Supervisor">
                    <Input
                      value={`${p.reportingManagerName}${p.reportingManagerPhone ? ` · ${p.reportingManagerPhone}` : ""}`}
                      disabled
                    />
                  </Field>
                )}
                {isCleaningStaff && (
                  <Field label="Reporting Manager (Supervisor)">
                    <Select value={p.reportingManagerId ? String(p.reportingManagerId) : ""} onValueChange={v => set("reportingManagerId", parseInt(v))}>
                      <SelectTrigger><SelectValue placeholder="Select supervisor" /></SelectTrigger>
                      <SelectContent>
                        {(supervisors ?? []).filter(m => m.id !== id).map(m => (
                          <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
                <Field label="Availability">
                  <Select value={p.availability ?? "available"} onValueChange={v => set("availability", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="unavailable">Unavailable</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Weekly Off"><Input value={p.weeklyOff ?? ""} placeholder="e.g. Sunday" onChange={e => set("weeklyOff", e.target.value)} /></Field>
                <Field label="Working Hours">
                  <div className="flex gap-2">
                    <Input type="time" value={p.workingHoursStart ?? "09:00"} onChange={e => set("workingHoursStart", e.target.value)} />
                    <Input type="time" value={p.workingHoursEnd ?? "18:00"} onChange={e => set("workingHoursEnd", e.target.value)} />
                  </div>
                </Field>
                <Field label="Own Vehicle"><Switch checked={!!p.ownsVehicle} onCheckedChange={v => set("ownsVehicle", v)} /></Field>
                {p.ownsVehicle && (
                  <>
                    <Field label="Vehicle Type">
                      <Select value={p.vehicleType ?? ""} onValueChange={v => set("vehicleType", v)}>
                        <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                        <SelectContent>
                          {["two_wheeler", "three_wheeler", "four_wheeler", "other"].map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Registration Number"><Input value={p.vehicleRegistrationNumber ?? ""} onChange={e => set("vehicleRegistrationNumber", e.target.value)} /></Field>
                    <Field label="Petrol Model">
                      <Select value={p.petrolModel ?? ""} onValueChange={v => set("petrolModel", v)}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="included">Included</SelectItem>
                          <SelectItem value="per_km">Per KM Reimbursement</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    {p.petrolModel === "per_km" && (
                      <Field label="Rate Per KM"><Input type="number" value={p.ratePerKm ?? ""} onChange={e => set("ratePerKm", e.target.value)} /></Field>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Current Address</CardTitle></CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-4">
                {([
                  ["House Number", "currentHouseNumber"],
                  ["Street", "currentStreet"],
                  ["Area", "currentArea"],
                  ["Landmark", "currentLandmark"],
                  ["City", "currentCity"],
                  ["State", "currentState"],
                  ["Pincode", "currentPincode"],
                ] as const).map(([lbl, key]) => (
                  <Field key={key} label={lbl}>
                    <Input value={String((p as Record<string, unknown>)[key] ?? "")} onChange={e => set(key, e.target.value)} />
                  </Field>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Permanent Address</CardTitle>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={!!p.permanentSameAsCurrent} onChange={e => set("permanentSameAsCurrent", e.target.checked)} />
                  Same as current
                </label>
              </CardHeader>
              {!p.permanentSameAsCurrent && (
                <CardContent className="grid sm:grid-cols-2 gap-4">
                  {([
                    ["House Number", "permanentHouseNumber"],
                    ["Street", "permanentStreet"],
                    ["Area", "permanentArea"],
                    ["Landmark", "permanentLandmark"],
                    ["City", "permanentCity"],
                    ["State", "permanentState"],
                    ["Pincode", "permanentPincode"],
                  ] as const).map(([lbl, key]) => (
                    <Field key={key} label={lbl}>
                      <Input value={String((p as Record<string, unknown>)[key] ?? "")} onChange={e => set(key, e.target.value)} />
                    </Field>
                  ))}
                </CardContent>
              )}
            </Card>

            <Button type="button" onClick={handleSave} disabled={saveMutation.isPending || !hasDraft}>
              Save Overview
            </Button>
          </TabsContent>

          <TabsContent value="roles" className="space-y-4">
            {staffCategory === "supervisor" ? (
              <Card>
                <CardContent className="p-5 text-sm text-muted-foreground">
                  Supervisor operational roles will be configured in a future update.
                </CardContent>
              </Card>
            ) : (
            <Card>
              <CardHeader><CardTitle className="text-base">Operational Roles & Skill Levels</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {(roleMaster ?? []).map(role => {
                  const assigned = profile.roles?.find(r => r.roleId === role.id);
                  return (
                    <div key={role.id} className="flex flex-col sm:flex-row sm:items-center gap-3 border rounded-lg p-3">
                      <label className="flex items-center gap-2 flex-1">
                        <input type="checkbox" checked={!!assigned} onChange={e => toggleRole(role.id, e.target.checked, assigned?.skillLevel ?? "basic")} />
                        <span className="font-medium text-sm">{role.name}</span>
                      </label>
                      {assigned && (
                        <Select value={assigned.skillLevel} onValueChange={v => toggleRole(role.id, true, v)}>
                          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["trainee", "basic", "intermediate", "expert"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
            )}
          </TabsContent>

          <TabsContent value="documents" className="space-y-4">
            <h3 className="font-semibold text-sm">Mandatory Documents</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {["aadhaar", "pan", "driving_license", "address_proof"].map(t => (
                <DocumentCard key={t} label={DOC_LABELS[t]} doc={docMap[t]} onView={setViewerUrl}
                  onUpload={(f, meta) => uploadDoc(t, f, meta)} />
              ))}
              <DocumentCard label="Bank Proof" doc={bankDoc} onView={setViewerUrl}
                onUpload={f => uploadDoc("bank_passbook", f)} />
            </div>
            <h3 className="font-semibold text-sm pt-4">Optional Compliance</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {OPTIONAL_DOCS.map(t => (
                <DocumentCard key={t} label={DOC_LABELS[t]} doc={docMap[t]} onView={setViewerUrl}
                  onUpload={f => uploadDoc(t, f)} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="banking" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Banking Details</CardTitle></CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-4">
                <Field label="Account Holder"><Input value={p.bankAccountName ?? ""} onChange={e => set("bankAccountName", e.target.value)} /></Field>
                <Field label="Bank Name"><Input value={p.bankName ?? ""} onChange={e => set("bankName", e.target.value)} /></Field>
                <Field label="Account Number"><Input value={p.bankAccountNumber ?? ""} onChange={e => set("bankAccountNumber", e.target.value)} /></Field>
                <Field label="IFSC"><Input value={p.bankIfsc ?? ""} onChange={e => set("bankIfsc", e.target.value)} /></Field>
                <Field label="Branch"><Input value={p.bankBranch ?? ""} onChange={e => set("bankBranch", e.target.value)} /></Field>
                <Field label="UPI ID"><Input value={p.upiId ?? ""} onChange={e => set("upiId", e.target.value)} /></Field>
              </CardContent>
            </Card>
            <Button type="button" onClick={handleSave} disabled={saveMutation.isPending || !hasDraft}>Save Banking</Button>
          </TabsContent>

          <TabsContent value="performance">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Briefcase size={16} /> Performance Profile</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                {[
                  ["Total Jobs", profile.performance.totalJobs],
                  ["Completed", profile.performance.completedJobs],
                  ["Daily Cleaning", profile.performance.dailyCleaningVisits],
                  ["Car Washes", profile.performance.carWashes],
                  ["Solar Jobs", profile.performance.solarJobs],
                  ["Solar AMC", profile.performance.solarAmcVisits],
                  ["Avg Rating", profile.performance.averageRating],
                  ["Complaints", profile.performance.complaintsReceived],
                  ["Last Job", profile.performance.lastJobDate ?? "—"],
                ].map(([k, v]) => (
                  <div key={String(k)} className="border rounded-lg p-3">
                    <p className="text-muted-foreground text-xs">{k}</p>
                    <p className="font-semibold text-lg flex items-center gap-1">
                      {k === "Avg Rating" && <Star size={14} className="text-primary" fill="currentColor" />}
                      {v}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notes" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Admin Notes</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add internal note..." rows={3} />
                <Button onClick={() => noteMutation.mutate(noteText)} disabled={!noteText.trim() || noteMutation.isPending}>Add Note</Button>
                <div className="space-y-3 pt-4 border-t">
                  {(profile.notes ?? []).map(n => (
                    <div key={n.id} className="text-sm border-l-2 border-primary/30 pl-3">
                      <p className="text-muted-foreground text-xs">{new Date(n.createdAt).toLocaleString()} · {n.authorName ?? "Admin"}</p>
                      <p>{n.note}</p>
                    </div>
                  ))}
                  {!(profile.notes?.length) && <p className="text-sm text-muted-foreground">No notes yet.</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="location" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin size={16} className="text-primary" />
                  Field location history
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-4">
                  GPS audit trail from shift check-in and job actions (On my way, Start, Complete). Geofence shows whether staff was within 150m of the customer at start/complete.
                </p>
                <StaffLocationHistory staffId={id} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!viewerUrl} onOpenChange={() => setViewerUrl(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex justify-between items-center">
              Document Preview
              {viewerUrl && (
                <Button size="sm" variant="outline" onClick={() => window.open(resolveMediaUrl(viewerUrl), "_blank")?.print?.()}>
                  <Printer size={14} className="mr-1" />Print
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          {viewerUrl && (
            viewerUrl.toLowerCase().includes(".pdf") || viewerUrl.includes("pdf")
              ? <iframe src={resolveMediaUrl(viewerUrl)} className="w-full h-[70vh] rounded border" title="Document" />
              : <img src={resolveMediaUrl(viewerUrl)} alt="Document" className="max-h-[70vh] mx-auto rounded" />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Portal Login</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Staff will sign in at <span className="font-medium">/login</span> with phone <span className="font-medium">{profile.phone}</span>
          </p>
          <div className="space-y-2">
            <Label htmlFor="loginPassword">Password</Label>
            <PasswordInput
              id="loginPassword"
              value={loginPassword}
              onChange={e => setLoginPassword(e.target.value)}
              placeholder="Minimum 6 characters"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setLoginOpen(false)}>Cancel</Button>
            <Button
              className="flex-1"
              disabled={loginPassword.length < 6 || createLoginMutation.isPending}
              onClick={() => createLoginMutation.mutate(loginPassword)}
            >
              {createLoginMutation.isPending ? "Creating..." : "Create Login"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
