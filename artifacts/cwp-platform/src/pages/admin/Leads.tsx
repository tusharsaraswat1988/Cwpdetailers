import { useState } from "react";
import { useLocation } from "wouter";
import AdminLayout from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { DataTable, Column } from "@/components/shared/DataTable";
import {
  Funnel, Plus, Phone, Calendar, MessageSquare, ArrowRight,
  CheckCircle, UserPlus, Search, Clock, ChevronDown, Send, X,
  BarChart3, TrendingUp, LayoutGrid, List, GripVertical,
} from "lucide-react";
import {
  DndContext, useDraggable, useDroppable, DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { PhoneInput } from "@/components/ui/phone-input";
import { submitMobile, submitOptionalMobile } from "@/lib/contactForm";
import { ToastAction } from "@/components/ui/toast";
import { CustomerProfileLink } from "@/features/customers/components/CustomerProfileLink";
import { LEAD_SOURCE_LABELS as SOURCE_LABEL } from "@/features/leads/constants";

const CUSTOMER_BASE_PATH = "/admin/customers";

/* ─── Types ─────────────────────────────────────────────────────────────── */

type LeadStatus = "new" | "contacted" | "interested" | "quotation" | "booked" | "completed" | "subscription" | "lost";

interface Lead {
  id: number;
  name: string;
  phone: string;
  secondaryPhone?: string | null;
  city?: string | null;
  source: string;
  serviceInterest?: string | null;
  assignedToStaffId?: number | null;
  assignedToName?: string | null;
  status: LeadStatus;
  notes?: string | null;
  nextFollowUpAt?: string | null;
  valueEstimate?: string | null;
  lostReason?: string | null;
  createdAt: string;
  updatedAt: string;
  customerId?: number | null;
  bookingId?: number | null;
  subscriptionId?: number | null;
}

interface LeadActivity {
  id: number;
  type: string;
  body: string;
  createdAt: string;
  createdBy?: number | null;
}

interface LeadStats {
  total: number;
  converted: number;
  conversionRate: number;
  bySource: { source: string; count: number }[];
  byStatus: { status: string; count: number }[];
}

/* ─── Pipeline config ───────────────────────────────────────────────────── */

const PIPELINE: { status: LeadStatus; label: string; color: string; borderColor: string }[] = [
  { status: "new", label: "New", color: "bg-blue-500/10 text-blue-400", borderColor: "border-blue-500/30" },
  { status: "contacted", label: "Contacted", color: "bg-yellow-500/10 text-yellow-400", borderColor: "border-yellow-500/30" },
  { status: "interested", label: "Interested", color: "bg-purple-500/10 text-purple-400", borderColor: "border-purple-500/30" },
  { status: "quotation", label: "Quotation", color: "bg-amber-500/10 text-amber-400", borderColor: "border-amber-500/30" },
  { status: "booked", label: "Booked", color: "bg-primary/10 text-primary", borderColor: "border-primary/30" },
  { status: "completed", label: "Completed", color: "bg-green-500/10 text-green-400", borderColor: "border-green-500/30" },
  { status: "subscription", label: "Subscription", color: "bg-emerald-500/10 text-emerald-400", borderColor: "border-emerald-500/30" },
  { status: "lost", label: "Lost", color: "bg-red-500/10 text-red-400", borderColor: "border-red-500/30" },
];

const LOST_REASON_LABEL: Record<string, string> = {
  too_expensive: "Too expensive", not_interested: "Not interested", no_response: "No response",
  chose_competitor: "Chose competitor", location_issue: "Location issue", other: "Other",
};

const SUBSCRIPTION_TYPES: { value: string; label: string }[] = [
  { value: "monthly_wash", label: "Monthly Wash" },
  { value: "solar_amc", label: "Solar AMC" },
  { value: "detailing_plan", label: "Detailing Plan" },
];

/* ─── API helpers ───────────────────────────────────────────────────────── */

async function fetchLeads(params: Record<string, string> = {}): Promise<{ data: Lead[]; total: number }> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/leads?${qs}`);
  if (!res.ok) throw new Error("Failed to fetch leads");
  return res.json();
}

async function createLead(body: Partial<Lead>) {
  const res = await fetch("/api/leads", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to create lead");
  return res.json();
}

async function patchLead(id: number, body: Partial<Lead>) {
  const res = await fetch(`/api/leads/${id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to update lead");
  return res.json();
}

async function addActivity(id: number, body: { type: string; body: string; followUpAt?: string }) {
  const res = await fetch(`/api/leads/${id}/activities`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to add activity");
  return res.json();
}

async function convertLead(id: number, body: Record<string, unknown>) {
  const res = await fetch(`/api/leads/${id}/convert`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to convert lead");
  return res.json() as Promise<{
    customerLinked?: boolean;
    customer?: { id: number; name?: string };
    booking?: { id: number };
    subscription?: { id: number };
  }>;
}

async function fetchLeadStats(): Promise<LeadStats> {
  const res = await fetch("/api/leads/stats");
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

async function fetchFollowUps(): Promise<Lead[]> {
  const res = await fetch("/api/leads/follow-ups");
  if (!res.ok) throw new Error("Failed to fetch follow-ups");
  return res.json();
}

async function fetchLeadDetail(id: number): Promise<Lead & { activities: LeadActivity[] }> {
  const res = await fetch(`/api/leads/${id}`);
  if (!res.ok) throw new Error("Failed to fetch lead");
  return res.json();
}

/* ─── Draggable Lead Card ──────────────────────────────────────────────── */

function DraggableLeadCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `lead-${lead.id}`, data: lead });
  const style = transform ? { transform: CSS.Transform.toString(transform), opacity: isDragging ? 0.5 : 1 } : {};

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <button onClick={onClick} className="w-full text-left bg-card border border-border rounded-lg p-3 hover:border-primary/40 hover:shadow-sm transition-all group cursor-pointer">
        <div className="flex items-center justify-between mb-1">
          <p className="font-medium text-sm truncate">{lead.name}</p>
          <span className="text-xs text-muted-foreground">#{lead.id}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Phone size={10} />{lead.phone}
          {lead.city && <span>· {lead.city}</span>}
        </div>
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-[10px] h-5">
            {SOURCE_LABEL[lead.source] || lead.source}
          </Badge>
          {lead.nextFollowUpAt && (
            <span className="flex items-center gap-1 text-[10px] text-yellow-400">
              <Calendar size={10} />{new Date(lead.nextFollowUpAt).toLocaleDateString("en-IN")}
            </span>
          )}
        </div>
        {lead.valueEstimate && (
          <p className="text-xs text-primary font-medium mt-1.5">
            Est. ₹{Number(lead.valueEstimate).toLocaleString("en-IN")}
          </p>
        )}
      </button>
    </div>
  );
}

/* ─── Droppable Column ─────────────────────────────────────────────────── */

function DroppableColumn({ status, children, label, color, borderColor, count }: {
  status: string; children: React.ReactNode; label: string; color: string; borderColor: string; count: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${status}` });
  return (
    <div ref={setNodeRef} className={`w-72 flex-shrink-0 rounded-xl border ${borderColor} ${isOver ? "bg-primary/5" : "bg-card/50"} transition-colors`}>
      <div className={`flex items-center justify-between px-3 py-2.5 border-b ${borderColor}`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${color.split(" ")[0]}`} />
          <span className="text-sm font-semibold">{label}</span>
        </div>
        <span className="text-xs text-muted-foreground bg-background/60 px-2 py-0.5 rounded-full">{count}</span>
      </div>
      <div className="p-2 space-y-2 min-h-[120px]">{children}</div>
    </div>
  );
}

/* ─── Component ─────────────────────────────────────────────────────────── */

type ViewMode = "kanban" | "list";
type DetailTab = "overview" | "activity" | "followups";

export default function AdminLeads() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [view, setView] = useState<ViewMode>("kanban");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterSource, setFilterSource] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [showConvert, setShowConvert] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showFollowUps, setShowFollowUps] = useState(false);

  const { data: leadsData, isLoading } = useQuery({
    queryKey: ["leads", search, filterStatus, filterSource],
    queryFn: () => fetchLeads({ search: search || "", status: filterStatus, source: filterSource, limit: "100" }),
  });

  const { data: stats } = useQuery({ queryKey: ["leadStats"], queryFn: fetchLeadStats });
  const { data: followUps } = useQuery({ queryKey: ["leadFollowUps"], queryFn: fetchFollowUps });
  const { data: detail } = useQuery({
    queryKey: ["leadDetail", detailId],
    queryFn: () => (detailId ? fetchLeadDetail(detailId) : null),
    enabled: !!detailId,
  });

  const createMut = useMutation({
    mutationFn: createLead,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leads"] }); qc.invalidateQueries({ queryKey: ["leadStats"] }); setOpen(false); toast({ title: "Lead created" }); },
    onError: (err: any) => toast({ title: "Failed to create lead", description: err?.error ?? err?.message, variant: "destructive" }),
  });

  const patchMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<Lead> }) => patchLead(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leads"] }); qc.invalidateQueries({ queryKey: ["leadStats"] }); qc.invalidateQueries({ queryKey: ["leadDetail", detailId] }); toast({ title: "Lead updated" }); },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const convertMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) => convertLead(id, body),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["leadStats"] });
      qc.invalidateQueries({ queryKey: ["/api/customers"] });
      setShowConvert(false);
      setDetailId(null);
      const customerId = data.customer?.id;
      if (customerId) {
        toast({
          title: data.customerLinked ? "Lead linked to existing customer" : "Lead converted successfully",
          description: `${data.customer?.name ?? "Customer"} #${customerId}${data.customerLinked ? " — no duplicate created." : ""}`,
          action: (
            <ToastAction
              altText="View customer profile"
              onClick={() => setLocation(`${CUSTOMER_BASE_PATH}/${customerId}`)}
              data-testid="toast-lead-view-customer"
            >
              View customer
            </ToastAction>
          ),
        });
      } else {
        toast({ title: "Lead converted successfully" });
      }
    },
    onError: () => toast({ title: "Failed to convert", variant: "destructive" }),
  });

  const activityMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: { type: string; body: string; followUpAt?: string } }) => addActivity(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leadDetail", detailId] }); qc.invalidateQueries({ queryKey: ["leadFollowUps"] }); toast({ title: "Activity added" }); },
  });

  const leads = leadsData?.data ?? [];
  const byStatus: Record<string, Lead[]> = {};
  for (const l of leads) {
    byStatus[l.status] = byStatus[l.status] ?? [];
    byStatus[l.status].push(l);
  }

  const [form, setForm] = useState({
    name: "", phone: "", secondaryPhone: "", city: "", source: "whatsapp" as string,
    serviceInterest: "", notes: "", valueEstimate: "", nextFollowUpAt: "",
  });
  const [formErrors, setFormErrors] = useState<{ phone?: string | null; secondaryPhone?: string | null }>({});
  const [newNote, setNewNote] = useState("");
  const [newFollowUp, setNewFollowUp] = useState("");
  const [convertForm, setConvertForm] = useState({
    createCustomer: true, createBooking: false, createSubscription: false,
    serviceId: "", scheduledDate: "", amount: "", subscriptionType: "monthly_wash",
    subStartDate: "", subEndDate: "", subPrice: "",
  });

  // Optimistic drag-and-drop handler
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const leadId = parseInt((active.id as string).replace("lead-", ""));
    const targetStatus = (over.id as string).replace("col-", "");
    const lead = leads.find(l => l.id === leadId);
    if (!lead || lead.status === targetStatus) return;

    // Optimistic UI update
    qc.setQueryData(["leads", search, filterStatus, filterSource], (old: any) => {
      if (!old) return old;
      return {
        ...old,
        data: old.data.map((l: Lead) => l.id === leadId ? { ...l, status: targetStatus as LeadStatus } : l),
      };
    });
    // API call
    patchMut.mutate({ id: leadId, body: { status: targetStatus as LeadStatus } });
  };

  // DataTable columns
  const listColumns: Column<Lead>[] = [
    { key: "name", header: "Name", cell: (l) => <span className="font-medium">{l.name}</span> },
    { key: "phone", header: "Phone", cell: (l) => <span className="text-xs text-muted-foreground">{l.phone}</span> },
    { key: "source", header: "Source", cell: (l) => <Badge variant="outline" className="text-[10px] h-5">{SOURCE_LABEL[l.source] || l.source}</Badge> },
    { key: "status", header: "Status", cell: (l) => {
      const col = PIPELINE.find(p => p.status === l.status);
      return <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${col?.color || ""}`}>{col?.label || l.status}</span>;
    } },
    { key: "city", header: "City", cell: (l) => <span className="text-xs text-muted-foreground">{l.city || "—"}</span> },
    { key: "value", header: "Est. Value", align: "right", cell: (l) => (
      <span className="text-xs text-primary font-medium">{l.valueEstimate ? `₹${Number(l.valueEstimate).toLocaleString("en-IN")}` : "—"}</span>
    ) },
    { key: "followUp", header: "Follow-up", align: "center", cell: (l) => (
      l.nextFollowUpAt ? <span className="text-[10px] text-yellow-400">{new Date(l.nextFollowUpAt).toLocaleDateString("en-IN")}</span> : <span className="text-[10px] text-muted-foreground">—</span>
    ) },
  ];

  return (
    <AdminLayout>
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl flex items-center gap-2">
              <Funnel size={22} className="text-primary" /> Leads & CRM
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Pipeline from inquiry to loyal customer</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowFollowUps(true)}>
              <Clock size={13} className="mr-1.5" />Follow-ups
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowStats(true)}>
              <BarChart3 size={13} className="mr-1.5" />Analytics
            </Button>
            <div className="flex items-center border border-border rounded-md overflow-hidden">
              <button onClick={() => setView("kanban")} className={`px-2 py-1.5 text-xs flex items-center gap-1 ${view === "kanban" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                <LayoutGrid size={12} />Kanban
              </button>
              <button onClick={() => setView("list")} className={`px-2 py-1.5 text-xs flex items-center gap-1 ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                <List size={12} />List
              </button>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus size={15} className="mr-1.5" />Add Lead
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>New Lead</DialogTitle></DialogHeader>
                <div className="space-y-3 mt-2">
                  <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <PhoneInput label="Phone" value={form.phone} onChange={v => setForm({ ...form, phone: v })} error={formErrors.phone} onErrorChange={err => setFormErrors(e => ({ ...e, phone: err }))} />
                    <PhoneInput label="Alt Phone" optional value={form.secondaryPhone} onChange={v => setForm({ ...form, secondaryPhone: v })} error={formErrors.secondaryPhone} onErrorChange={err => setFormErrors(e => ({ ...e, secondaryPhone: err }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>City</Label><Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="City" /></div>
                    <div>
                      <Label>Source</Label>
                      <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-sm">
                        {Object.keys(SOURCE_LABEL).map(s => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Service Interest</Label>
                      <select value={form.serviceInterest} onChange={e => setForm({ ...form, serviceInterest: e.target.value })} className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-sm">
                        <option value="">Select...</option>
                        <option value="one_time_wash">One-time Wash</option>
                        <option value="detailing">Detailing</option>
                        <option value="daily_cleaning">Daily Cleaning</option>
                        <option value="solar">Solar</option>
                        <option value="accessories">Accessories</option>
                      </select>
                    </div>
                    <div><Label>Follow-up Date</Label><Input type="datetime-local" value={form.nextFollowUpAt} onChange={e => setForm({ ...form, nextFollowUpAt: e.target.value })} /></div>
                  </div>
                  <div><Label>Value Estimate (₹)</Label><Input value={form.valueEstimate} onChange={e => setForm({ ...form, valueEstimate: e.target.value })} placeholder="Estimated value" /></div>
                  <div>
                    <Label>Notes</Label>
                    <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm resize-none h-20" placeholder="Initial notes..." />
                  </div>
                  <Button className="w-full bg-primary text-primary-foreground" onClick={() => {
                    const phoneResult = submitMobile(form.phone);
                    const secondaryResult = submitOptionalMobile(form.secondaryPhone);
                    setFormErrors({
                      phone: phoneResult.ok ? null : phoneResult.error,
                      secondaryPhone: secondaryResult.ok ? null : secondaryResult.error,
                    });
                    if (!phoneResult.ok || !secondaryResult.ok) {
                      toast({ title: "Please fix phone format", variant: "destructive" });
                      return;
                    }
                    createMut.mutate({
                    name: form.name, phone: phoneResult.value, secondaryPhone: secondaryResult.value,
                    city: form.city || undefined, source: form.source as any,
                    serviceInterest: form.serviceInterest as any || undefined,
                    notes: form.notes || undefined, valueEstimate: form.valueEstimate || undefined,
                    nextFollowUpAt: form.nextFollowUpAt ? new Date(form.nextFollowUpAt).toISOString() : undefined,
                  });
                  }}>Create Lead</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or phone..." className="pl-9" />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-background border border-border rounded-md px-3 py-2 text-sm">
            <option value="">All Statuses</option>
            {PIPELINE.map(p => <option key={p.status} value={p.status}>{p.label}</option>)}
          </select>
          <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className="bg-background border border-border rounded-md px-3 py-2 text-sm">
            <option value="">All Sources</option>
            {Object.keys(SOURCE_LABEL).map(s => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
          </select>
          <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            <span className="bg-primary/10 text-primary px-2 py-1 rounded-md font-medium">{stats?.total ?? 0} total</span>
            <span className="bg-green-500/10 text-green-400 px-2 py-1 rounded-md font-medium">{stats?.conversionRate ?? 0}% converted</span>
          </div>
        </div>

        {/* Kanban Board */}
        {view === "kanban" && (
          <DndContext onDragEnd={handleDragEnd}>
            <div className="overflow-x-auto pb-2">
              <div className="flex gap-4 min-w-max">
                {PIPELINE.map(col => {
                  const items = byStatus[col.status] ?? [];
                  return (
                    <DroppableColumn key={col.status} status={col.status} label={col.label} color={col.color} borderColor={col.borderColor} count={items.length}>
                      {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">Loading…</div>
                      ) : items.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground text-xs italic">No leads</div>
                      ) : (
                        items.map(lead => (
                          <DraggableLeadCard key={lead.id} lead={lead} onClick={() => setDetailId(lead.id)} />
                        ))
                      )}
                    </DroppableColumn>
                  );
                })}
              </div>
            </div>
          </DndContext>
        )}

        {/* List View */}
        {view === "list" && (
          <DataTable
            columns={listColumns}
            rows={leads}
            isLoading={isLoading}
            rowKey={l => l.id}
            onRowClick={l => setDetailId(l.id)}
            emptyTitle="No leads found"
            emptyDescription="Try adjusting your filters or add a new lead."
          />
        )}
      </div>

      {/* ─── Detail Drawer ─────────────────────────────────────────────── */}
      {detailId && detail && (
        <div className="fixed inset-0 z-50 bg-black/60 flex justify-end">
          <div className="w-full max-w-lg bg-background h-full overflow-y-auto border-l border-border shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h2 className="font-display font-bold text-lg">{detail.name}</h2>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <Phone size={10} />{detail.phone}
                  {detail.secondaryPhone && <span>· {detail.secondaryPhone}</span>}
                  {detail.city && <span>· {detail.city}</span>}
                </div>
              </div>
              <button onClick={() => setDetailId(null)} className="text-muted-foreground hover:text-white"><X size={18} /></button>
            </div>

            <div className="p-5 space-y-5">
              {/* Tabs */}
              <div className="flex items-center gap-1 border-b border-border">
                {(["overview", "activity", "followups"] as DetailTab[]).map(tab => (
                  <button key={tab} onClick={() => setDetailTab(tab)}
                    className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${detailTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-white"}`}>
                    {tab === "overview" ? "Overview" : tab === "activity" ? "Activity" : "Follow-ups"}
                  </button>
                ))}
              </div>

              {/* ── Overview Tab ── */}
              {detailTab === "overview" && (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 flex-wrap">
                    <select value={detail.status} onChange={e => patchMut.mutate({ id: detail.id, body: { status: e.target.value as any } })}
                      className="bg-card border border-border rounded-md px-3 py-1.5 text-sm font-medium">
                      {PIPELINE.map(p => <option key={p.status} value={p.status}>{p.label}</option>)}
                    </select>
                    <Badge variant="outline">{SOURCE_LABEL[detail.source] || detail.source}</Badge>
                    {detail.serviceInterest && <Badge variant="outline" className="capitalize">{detail.serviceInterest.replace("_", " ")}</Badge>}
                    {detail.valueEstimate && <span className="text-primary font-medium text-sm">₹{Number(detail.valueEstimate).toLocaleString("en-IN")}</span>}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => setShowConvert(true)}><UserPlus size={13} className="mr-1.5" />Convert to Customer</Button>
                    {detail.status !== "lost" && <Button size="sm" variant="outline" onClick={() => patchMut.mutate({ id: detail.id, body: { status: "lost" } })}><X size={13} className="mr-1.5" />Mark Lost</Button>}
                  </div>
                  {showConvert && (
                    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                      <h3 className="font-semibold text-sm flex items-center gap-2"><ArrowRight size={14} className="text-primary" />Convert Lead</h3>
                      <div className="space-y-2 text-sm">
                        <label className="flex items-center gap-2"><input type="checkbox" checked={convertForm.createCustomer} onChange={e => setConvertForm({ ...convertForm, createCustomer: e.target.checked })} />Create Customer</label>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={convertForm.createBooking} onChange={e => setConvertForm({ ...convertForm, createBooking: e.target.checked })} />Create Booking</label>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={convertForm.createSubscription} onChange={e => setConvertForm({ ...convertForm, createSubscription: e.target.checked })} />Create Subscription</label>
                      </div>
                      {convertForm.createBooking && (
                        <div className="grid grid-cols-2 gap-3">
                          <Input placeholder="Service ID" value={convertForm.serviceId} onChange={e => setConvertForm({ ...convertForm, serviceId: e.target.value })} />
                          <Input type="date" placeholder="Scheduled date" value={convertForm.scheduledDate} onChange={e => setConvertForm({ ...convertForm, scheduledDate: e.target.value })} />
                          <Input placeholder="Amount (₹)" value={convertForm.amount} onChange={e => setConvertForm({ ...convertForm, amount: e.target.value })} />
                        </div>
                      )}
                      {convertForm.createSubscription && (
                        <div className="space-y-2">
                          <select value={convertForm.subscriptionType} onChange={e => setConvertForm({ ...convertForm, subscriptionType: e.target.value })} className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-sm">
                            {SUBSCRIPTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                          <div className="grid grid-cols-2 gap-3">
                            <Input type="date" placeholder="Start date" value={convertForm.subStartDate} onChange={e => setConvertForm({ ...convertForm, subStartDate: e.target.value })} />
                            <Input type="date" placeholder="End date" value={convertForm.subEndDate} onChange={e => setConvertForm({ ...convertForm, subEndDate: e.target.value })} />
                          </div>
                          <Input placeholder="Price (₹)" value={convertForm.subPrice} onChange={e => setConvertForm({ ...convertForm, subPrice: e.target.value })} />
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => convertMut.mutate({ id: detail.id, body: convertForm })}><CheckCircle size={13} className="mr-1.5" />Confirm</Button>
                        <Button size="sm" variant="outline" onClick={() => setShowConvert(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                  {(detail.customerId || detail.bookingId || detail.subscriptionId) && (
                    <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4 space-y-2">
                      <h3 className="font-semibold text-sm text-green-400 flex items-center gap-2"><CheckCircle size={14} />Converted</h3>
                      {detail.customerId && (
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm">Customer #{detail.customerId}</p>
                          <CustomerProfileLink customerId={detail.customerId} customerBasePath={CUSTOMER_BASE_PATH} />
                        </div>
                      )}
                      {detail.bookingId && <p className="text-sm">Booking ID: <span className="font-medium">{detail.bookingId}</span></p>}
                      {detail.subscriptionId && <p className="text-sm">Subscription ID: <span className="font-medium">{detail.subscriptionId}</span></p>}
                    </div>
                  )}
                </div>
              )}

              {/* ── Activity Tab ── */}
              {detailTab === "activity" && (
                <div className="space-y-5">
                  <div className="space-y-3">
                    {detail.activities?.map((act, i) => (
                      <div key={act.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                          {i < (detail.activities?.length ?? 0) - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                        </div>
                        <div className="flex-1 pb-3">
                          <div className="flex items-center gap-2 mb-0.5">
                            <Badge variant="outline" className="text-[10px] h-5 capitalize">{act.type}</Badge>
                            <span className="text-xs text-muted-foreground">{new Date(act.createdAt).toLocaleString("en-IN")}</span>
                          </div>
                          <p className="text-sm text-white/80">{act.body}</p>
                        </div>
                      </div>
                    ))}
                    {(detail.activities?.length ?? 0) === 0 && <p className="text-sm text-muted-foreground italic">No activities yet</p>}
                  </div>
                  <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                    <h3 className="font-semibold text-sm">Add Note</h3>
                    <textarea value={newNote} onChange={e => setNewNote(e.target.value)} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm resize-none h-20" placeholder="Write a note..." />
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-sm"><Calendar size={13} className="text-muted-foreground" /><Input type="datetime-local" value={newFollowUp} onChange={e => setNewFollowUp(e.target.value)} className="w-48 text-sm" /></div>
                      <Button size="sm" className="bg-primary text-primary-foreground ml-auto" onClick={() => { activityMut.mutate({ id: detail.id, body: { type: "note", body: newNote, followUpAt: newFollowUp } }); setNewNote(""); setNewFollowUp(""); }}>
                        <Send size={13} className="mr-1.5" />Save
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Follow-ups Tab ── */}
              {detailTab === "followups" && (
                <div className="space-y-4">
                  <div className="bg-card border border-border rounded-xl p-4">
                    <h3 className="font-semibold text-sm mb-2">Next Follow-up</h3>
                    {detail.nextFollowUpAt ? (
                      <div className="flex items-center gap-2 text-sm text-yellow-400">
                        <Calendar size={14} />{new Date(detail.nextFollowUpAt).toLocaleString("en-IN")}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No follow-up scheduled</p>
                    )}
                  </div>
                  <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                    <h3 className="font-semibold text-sm">Schedule Follow-up</h3>
                    <Input type="datetime-local" value={newFollowUp} onChange={e => setNewFollowUp(e.target.value)} />
                    <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => { activityMut.mutate({ id: detail.id, body: { type: "follow_up", body: "Follow-up scheduled", followUpAt: newFollowUp } }); setNewFollowUp(""); }}>
                      <Calendar size={13} className="mr-1.5" />Schedule
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Follow-ups Modal ──────────────────────────────────────────── */}
      {showFollowUps && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-background rounded-xl border border-border shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold text-sm flex items-center gap-2"><Clock size={14} className="text-primary" />Due Follow-ups</h3>
              <button onClick={() => setShowFollowUps(false)} className="text-muted-foreground hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-2">
              {(followUps ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No follow-ups due today</p>
              ) : (
                (followUps ?? []).map(l => (
                  <div key={l.id} className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg hover:border-primary/40 transition-all cursor-pointer"
                    onClick={() => { setShowFollowUps(false); setDetailId(l.id); }}>
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0"><Calendar size={13} className="text-primary" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{l.name}</p>
                      <p className="text-xs text-muted-foreground">{l.phone} · {l.city || "—"}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-yellow-400 font-medium">{l.nextFollowUpAt ? new Date(l.nextFollowUpAt).toLocaleDateString("en-IN") : "—"}</p>
                      <p className="text-[10px] text-muted-foreground">{SOURCE_LABEL[l.source] || l.source}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Stats Modal ─────────────────────────────────────────────────── */}
      {showStats && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-background rounded-xl border border-border shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold text-sm flex items-center gap-2"><BarChart3 size={14} className="text-primary" />Lead Analytics</h3>
              <button onClick={() => setShowStats(false)} className="text-muted-foreground hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-5">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-card border border-border rounded-xl p-4 text-center"><p className="font-bold text-2xl text-primary">{stats?.total ?? 0}</p><p className="text-xs text-muted-foreground mt-0.5">Total Leads</p></div>
                <div className="bg-card border border-border rounded-xl p-4 text-center"><p className="font-bold text-2xl text-green-400">{stats?.converted ?? 0}</p><p className="text-xs text-muted-foreground mt-0.5">Converted</p></div>
                <div className="bg-card border border-border rounded-xl p-4 text-center"><p className="font-bold text-2xl text-emerald-400">{stats?.conversionRate ?? 0}%</p><p className="text-xs text-muted-foreground mt-0.5">Conversion Rate</p></div>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><TrendingUp size={14} className="text-primary" />By Source</h4>
                <div className="space-y-1.5">
                  {(stats?.bySource ?? []).map(s => (
                    <div key={s.source} className="flex items-center gap-3">
                      <span className="text-sm w-24 truncate">{SOURCE_LABEL[s.source] || s.source}</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${Math.max((s.count / (stats?.total || 1)) * 100, 3)}%` }} /></div>
                      <span className="text-sm font-medium w-8 text-right">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2">By Status</h4>
                <div className="grid grid-cols-2 gap-2">
                  {(stats?.byStatus ?? []).map(s => {
                    const col = PIPELINE.find(p => p.status === s.status);
                    return (
                      <div key={s.status} className={`flex items-center justify-between p-2.5 rounded-lg border ${col?.borderColor || "border-border"} bg-card`}>
                        <span className="text-sm capitalize">{col?.label || s.status}</span>
                        <span className={`text-sm font-bold ${col?.color.split(" ")[1] || "text-white"}`}>{s.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
