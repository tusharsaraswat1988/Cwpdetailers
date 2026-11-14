import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/layout/AdminLayout";
import { PageActionHeader } from "@/components/layout/PageActionHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Send,
  Lock,
  PlusCircle,
  RefreshCw,
  UserCheck,
  ShieldAlert,
  Search,
  ExternalLink,
  Calendar,
  Phone,
  Building2,
  MapPin,
  User,
} from "lucide-react";
import { supportApi, type SupportTicket } from "@/lib/support/api";
import { useAppStore } from "@/lib/store";
import { Link } from "wouter";

const statusColors: Record<string, string> = {
  open: "bg-red-500/10 text-red-600 border-red-500/20",
  assigned: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  in_progress: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  awaiting_customer: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  resolved: "bg-green-500/10 text-green-600 border-green-500/20",
  closed: "bg-muted text-muted-foreground border-muted",
};

const priorityBadges: Record<string, { label: string; color: string }> = {
  urgent: { label: "Urgent", color: "bg-red-600 text-white border-red-700 animate-pulse" },
  high: { label: "High", color: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
  medium: { label: "Medium", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  low: { label: "Low", color: "bg-slate-500/10 text-slate-600 border-slate-500/20" },
};

const categoryMap: Record<string, string> = {
  quality: "Service Quality",
  delay: "Booking / Delay Issue",
  reclean: "Reclean Request",
  damage: "Vehicle Damage Concern",
  billing: "Payment / Refund Issue",
  subscription: "Subscription Issue",
  other: "Other / Staff Behaviour",
};

export default function AdminComplaints() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { activeCityId, activeBranchId } = useAppStore();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

  // Message & Resolution state
  const [activeTab, setActiveTab] = useState<"conversation" | "internal">("conversation");
  const [customerMessage, setCustomerMessage] = useState("");
  const [internalNote, setInternalNote] = useState("");

  // Resolve dialog state
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolveAction, setResolveAction] = useState<
    "grant_makeup_credit" | "schedule_reclean" | "reassign_staff" | "custom_resolution" | "no_action_needed"
  >("grant_makeup_credit");
  const [resolveNote, setResolveNote] = useState("");
  const [resolveInternalNote, setResolveInternalNote] = useState("");

  // Create ticket dialog state
  const [createTicketOpen, setCreateTicketOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    customerId: "",
    bookingId: "",
    type: "quality",
    priority: "high",
    title: "",
    description: "",
  });

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("customerId");
    if (id) {
      setSearch(`customer:${id}`);
      setCreateForm((f) => ({ ...f, customerId: id }));
    }
  }, []);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-support-tickets", statusFilter, priorityFilter, categoryFilter, search, activeCityId, activeBranchId],
    queryFn: () =>
      supportApi.listTickets({
        status: statusFilter,
        priority: priorityFilter,
        type: categoryFilter !== "all" ? categoryFilter : undefined,
        search: search.trim() || undefined,
        cityId: activeCityId ?? undefined,
        branchId: activeBranchId ?? undefined,
      }),
    refetchInterval: 30_000,
  });

  const { data: activeTicket, refetch: refetchDetail } = useQuery({
    queryKey: ["admin-support-ticket-detail", selectedTicketId],
    queryFn: () => supportApi.getTicket(selectedTicketId!),
    enabled: selectedTicketId != null,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      supportApi.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
      refetchDetail();
      toast({ title: "Ticket status updated" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to update status", description: err.message, variant: "destructive" });
    },
  });

  const addMessageMutation = useMutation({
    mutationFn: ({ id, msg, isInternal }: { id: number; msg: string; isInternal: boolean }) =>
      supportApi.addMessage(id, { message: msg, isInternal }),
    onSuccess: (_, vars) => {
      if (vars.isInternal) setInternalNote("");
      else setCustomerMessage("");
      refetchDetail();
      qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
      toast({
        title: vars.isInternal ? "Internal note recorded (Private)" : "Reply sent to customer",
      });
    },
    onError: (err: any) => {
      toast({ title: "Failed to record message", description: err.message, variant: "destructive" });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: () =>
      supportApi.resolveTicket(selectedTicketId!, {
        resolutionAction: resolveAction,
        resolution: resolveNote,
        internalNotes: resolveInternalNote,
      }),
    onSuccess: () => {
      setResolveDialogOpen(false);
      setResolveNote("");
      setResolveInternalNote("");
      qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
      refetchDetail();
      toast({
        title: "Ticket resolved successfully",
        description:
          resolveAction === "grant_makeup_credit"
            ? "Makeup cleaning credit (+1) granted to customer subscription."
            : "Customer notified of resolution.",
      });
    },
    onError: (err: any) => {
      toast({ title: "Resolution failed", description: err.message, variant: "destructive" });
    },
  });

  const createTicketMutation = useMutation({
    mutationFn: () =>
      supportApi.createTicket({
        customerId: Number(createForm.customerId),
        bookingId: createForm.bookingId ? Number(createForm.bookingId) : undefined,
        type: createForm.type,
        priority: createForm.priority,
        title: createForm.title.trim(),
        description: createForm.description.trim(),
        cityId: activeCityId ?? undefined,
        branchId: activeBranchId ?? undefined,
      }),
    onSuccess: () => {
      setCreateTicketOpen(false);
      setCreateForm({
        customerId: "",
        bookingId: "",
        type: "quality",
        priority: "high",
        title: "",
        description: "",
      });
      qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
      toast({ title: "Support ticket created successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to create ticket", description: err.message, variant: "destructive" });
    },
  });

  const tickets = data?.data ?? [];
  const openCount = tickets.filter(
    (t) => t.status === "open" || t.status === "assigned" || t.status === "in_progress",
  ).length;
  const overdueCount = tickets.filter((t) => t.isOverdue).length;

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-5" data-testid="support-command-center">
        <PageActionHeader
          title="Customer Support Intelligence"
          description={`${data?.total ?? 0} total tickets · ${openCount} active · ${overdueCount} SLA overdue (>24h)`}
          primaryAction={{
            label: "Create Support Case",
            onClick: () => setCreateTicketOpen(true),
            icon: PlusCircle,
            testId: "complaints-create-cta",
          }}
        />

        {/* Filters bar */}
        <div className="flex flex-wrap items-center gap-3 bg-card border border-border p-3 rounded-xl shadow-sm">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ticket #, customer, phone, keywords..."
              className="pl-8 h-8 text-xs"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="awaiting_customer">Awaiting Customer</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue placeholder="All Priorities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="quality">Service Quality</SelectItem>
              <SelectItem value="delay">Booking Delay</SelectItem>
              <SelectItem value="reclean">Reclean Request</SelectItem>
              <SelectItem value="damage">Vehicle Damage</SelectItem>
              <SelectItem value="billing">Payment / Refund</SelectItem>
              <SelectItem value="subscription">Subscription Issue</SelectItem>
              <SelectItem value="other">Other / Staff Behaviour</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => refetch()} title="Refresh">
            <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
          </Button>
        </div>

        {/* Tickets Grid */}
        <div id="support-list" className="space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)
          ) : tickets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-card border rounded-xl">
              <CheckCircle2 size={32} className="mx-auto text-green-500 mb-2" />
              <p className="font-semibold text-sm">No support tickets found</p>
              <p className="text-xs">No active cases match your current filters.</p>
            </div>
          ) : (
            tickets.map((t) => {
              const pConf = priorityBadges[t.priority] ?? priorityBadges.medium;
              const sColor = statusColors[t.status] ?? statusColors.open;

              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedTicketId(t.id)}
                  className={`bg-card border rounded-xl p-4 sm:p-5 cursor-pointer hover:border-primary/50 transition-colors shadow-sm ${
                    t.isOverdue ? "border-red-500/30 bg-red-500/5" : "border-border"
                  }`}
                  data-testid={`complaint-${t.id}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-primary">
                          {t.ticketNumber}
                        </span>
                        <Badge variant="outline" className={`text-xs ${sColor}`}>
                          {t.status.replace(/_/g, " ")}
                        </Badge>
                        <Badge variant="outline" className={`text-xs ${pConf.color}`}>
                          {pConf.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {categoryMap[t.type] || t.type}
                        </span>
                        {t.isOverdue && (
                          <Badge variant="destructive" className="text-[10px] h-5 gap-1">
                            <Clock size={10} /> SLA Overdue (&gt;24h)
                          </Badge>
                        )}
                        {t.operationalExceptionId && (
                          <Badge variant="secondary" className="text-[10px] h-5 bg-amber-500/10 text-amber-700">
                            Linked Exception #{t.operationalExceptionId}
                          </Badge>
                        )}
                      </div>

                      <h3 className="font-semibold text-sm sm:text-base text-foreground">{t.title}</h3>
                      {t.description && (
                        <p className="text-muted-foreground text-xs line-clamp-2">{t.description}</p>
                      )}

                      {/* Operational Link Pills */}
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                        <Link
                          href={`/admin/customers/${t.customerId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 bg-secondary/80 hover:bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-[11px] font-medium"
                        >
                          <Phone size={10} className="text-primary" />
                          {t.customerName || `Customer #${t.customerId}`}
                        </Link>

                        {t.bookingId && (
                          <Link
                            href={`/admin/bookings?bookingId=${t.bookingId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 bg-secondary/80 hover:bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-[11px] font-medium"
                          >
                            <Calendar size={10} className="text-primary" />
                            Booking #{t.bookingId}
                          </Link>
                        )}

                        <span className="flex items-center gap-1">
                          <MapPin size={10} /> {t.cityName || "All"} {t.branchName ? `· ${t.branchName}` : ""}
                        </span>

                        {t.assignedSupervisorName && (
                          <span className="flex items-center gap-1">
                            <UserCheck size={10} /> Owner: {t.assignedSupervisorName}
                          </span>
                        )}
                      </div>

                      {t.resolution && (
                        <p className="text-xs text-green-700 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 mt-2">
                          <CheckCircle2 size={12} /> {t.resolution}
                        </p>
                      )}
                    </div>

                    <div className="sm:text-right flex-shrink-0 space-y-2">
                      <div>
                        <p className="text-xs text-muted-foreground font-mono">{t.customerPhone}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(t.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>

                      <div className="flex gap-1 sm:justify-end">
                        {t.status !== "resolved" && t.status !== "closed" && (
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white gap-1"
                            data-testid={`btn-resolve-${t.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTicketId(t.id);
                              setResolveDialogOpen(true);
                            }}
                          >
                            <CheckCircle2 size={12} /> Resolve
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Ticket Drawer */}
        <Sheet open={selectedTicketId != null} onOpenChange={(open) => !open && setSelectedTicketId(null)}>
          <SheetContent className="sm:max-w-xl flex flex-col h-full">
            {activeTicket ? (
              <>
                <SheetHeader className="border-b pb-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-primary">
                      {activeTicket.ticketNumber}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Select
                        value={activeTicket.status}
                        onValueChange={(val) =>
                          updateStatusMutation.mutate({ id: activeTicket.id, status: val })
                        }
                      >
                        <SelectTrigger className="h-7 text-xs w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="assigned">Assigned</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="awaiting_customer">Awaiting Customer</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                      {activeTicket.status !== "resolved" && (
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => setResolveDialogOpen(true)}
                        >
                          Resolve
                        </Button>
                      )}
                    </div>
                  </div>

                  <SheetTitle className="text-base text-left">{activeTicket.title}</SheetTitle>
                  <SheetDescription className="text-xs text-left">
                    Customer: <span className="font-semibold">{activeTicket.customerName}</span> ({activeTicket.customerPhone}) · {activeTicket.cityName} / {activeTicket.branchName}
                  </SheetDescription>
                </SheetHeader>

                {/* Context Pills & 1-Click Profile Link */}
                <div className="py-2.5 px-3 bg-muted/40 rounded-lg text-xs space-y-1.5 border">
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Priority: <span className="font-semibold uppercase text-foreground">{activeTicket.priority}</span></span>
                    <span>Category: <span className="font-semibold capitalize text-foreground">{categoryMap[activeTicket.type] || activeTicket.type}</span></span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Link
                      href={`/admin/customers/${activeTicket.customerId}`}
                      className="text-primary hover:underline font-semibold flex items-center gap-1 text-[11px]"
                    >
                      <User size={12} /> Open Customer 360 View →
                    </Link>
                    {activeTicket.bookingId && (
                      <Link
                        href={`/admin/bookings?bookingId=${activeTicket.bookingId}`}
                        className="text-primary hover:underline font-semibold flex items-center gap-1 text-[11px] ml-auto"
                      >
                        <Calendar size={12} /> View Booking #{activeTicket.bookingId} →
                      </Link>
                    )}
                  </div>
                </div>

                {/* Tabs: Customer Discussion vs Internal Notes */}
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col">
                  <TabsList className="grid grid-cols-2 w-full mt-2">
                    <TabsTrigger value="conversation" className="text-xs">
                      Customer Discussion
                    </TabsTrigger>
                    <TabsTrigger value="internal" className="text-xs flex items-center gap-1">
                      <Lock size={12} /> Internal Notes (Shielded)
                    </TabsTrigger>
                  </TabsList>

                  {/* Public Conversation */}
                  <TabsContent value="conversation" className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto py-3 space-y-3">
                      {(activeTicket.messages ?? [])
                        .filter((m) => !m.isInternal)
                        .map((m) => {
                          const isStaff = m.senderType === "admin" || m.senderType === "staff";
                          return (
                            <div
                              key={m.id}
                              className={`flex flex-col ${isStaff ? "items-end" : "items-start"}`}
                            >
                              <div
                                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs shadow-sm ${
                                  isStaff
                                    ? "bg-primary text-primary-foreground rounded-br-xs"
                                    : "bg-muted text-foreground border rounded-bl-xs"
                                }`}
                              >
                                <div className="text-[10px] font-semibold opacity-80 mb-0.5">
                                  {m.senderName} ({m.senderType})
                                </div>
                                <p className="whitespace-pre-wrap">{m.message}</p>
                              </div>
                              <span className="text-[10px] text-muted-foreground mt-0.5 px-1">
                                {new Date(m.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          );
                        })}
                    </div>

                    <div className="pt-2 border-t flex gap-2">
                      <Input
                        value={customerMessage}
                        onChange={(e) => setCustomerMessage(e.target.value)}
                        placeholder="Type reply visible to customer..."
                        className="text-xs h-9"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey && customerMessage.trim()) {
                            e.preventDefault();
                            addMessageMutation.mutate({
                              id: activeTicket.id,
                              msg: customerMessage.trim(),
                              isInternal: false,
                            });
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        className="h-9 px-3 shrink-0"
                        disabled={!customerMessage.trim() || addMessageMutation.isPending}
                        onClick={() =>
                          addMessageMutation.mutate({
                            id: activeTicket.id,
                            msg: customerMessage.trim(),
                            isInternal: false,
                          })
                        }
                      >
                        <Send size={13} />
                      </Button>
                    </div>
                  </TabsContent>

                  {/* Strictly Internal Notes */}
                  <TabsContent value="internal" className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-md text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-1.5 my-2">
                      <Lock size={12} className="shrink-0" />
                      <span>Confidential: Internal notes are strictly shielded and NEVER visible to customers.</span>
                    </div>

                    <div className="flex-1 overflow-y-auto py-2 space-y-2.5">
                      {(activeTicket.messages ?? [])
                        .filter((m) => m.isInternal)
                        .map((m) => (
                          <div key={m.id} className="bg-muted/60 border rounded-lg p-2.5 text-xs space-y-1">
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span className="font-semibold text-foreground">{m.senderName}</span>
                              <span>
                                {new Date(m.createdAt).toLocaleString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            <p className="whitespace-pre-wrap">{m.message}</p>
                          </div>
                        ))}
                    </div>

                    <div className="pt-2 border-t flex gap-2">
                      <Input
                        value={internalNote}
                        onChange={(e) => setInternalNote(e.target.value)}
                        placeholder="Add staff-only private note..."
                        className="text-xs h-9"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey && internalNote.trim()) {
                            e.preventDefault();
                            addMessageMutation.mutate({
                              id: activeTicket.id,
                              msg: internalNote.trim(),
                              isInternal: true,
                            });
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-9 px-3 shrink-0 gap-1 text-xs"
                        disabled={!internalNote.trim() || addMessageMutation.isPending}
                        onClick={() =>
                          addMessageMutation.mutate({
                            id: activeTicket.id,
                            msg: internalNote.trim(),
                            isInternal: true,
                          })
                        }
                      >
                        <Lock size={12} /> Record Note
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </>
            ) : (
              <div className="space-y-4 py-8">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-20 w-full" />
              </div>
            )}
          </SheetContent>
        </Sheet>

        {/* Resolve Ticket Dialog */}
        <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Resolve Support Case</DialogTitle>
              <DialogDescription>
                Record resolution action and optional customer compensation.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Resolution Action</Label>
                <Select value={resolveAction} onValueChange={(v) => setResolveAction(v as any)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grant_makeup_credit">Grant Makeup Cleaning Credit (+1)</SelectItem>
                    <SelectItem value="schedule_reclean">Schedule Free Reclean</SelectItem>
                    <SelectItem value="reassign_staff">Reassign Service Staff</SelectItem>
                    <SelectItem value="custom_resolution">Custom Customer Agreement</SelectItem>
                    <SelectItem value="no_action_needed">No Further Action Required</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Customer Resolution Summary *</Label>
                <Textarea
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  placeholder="Summary sent/explained to customer..."
                  rows={2}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Private Internal Audit Note</Label>
                <Textarea
                  value={resolveInternalNote}
                  onChange={(e) => setResolveInternalNote(e.target.value)}
                  placeholder="Confidential root-cause analysis for supervisors..."
                  rows={2}
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setResolveDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => resolveMutation.mutate()}
                disabled={resolveMutation.isPending || !resolveNote.trim()}
              >
                {resolveMutation.isPending ? "Resolving..." : "Confirm Resolution"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Support Case Dialog */}
        <Dialog open={createTicketOpen} onOpenChange={setCreateTicketOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Support Case</DialogTitle>
              <DialogDescription>
                Open an authoritative customer support case linked to operational records.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Customer ID *</Label>
                  <Input
                    value={createForm.customerId}
                    onChange={(e) => setCreateForm({ ...createForm, customerId: e.target.value })}
                    placeholder="e.g. 45"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Booking ID (optional)</Label>
                  <Input
                    value={createForm.bookingId}
                    onChange={(e) => setCreateForm({ ...createForm, bookingId: e.target.value })}
                    placeholder="e.g. 120"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Category</Label>
                  <Select
                    value={createForm.type}
                    onValueChange={(val) => setCreateForm({ ...createForm, type: val })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quality">Service Quality</SelectItem>
                      <SelectItem value="delay">Booking Delay</SelectItem>
                      <SelectItem value="reclean">Reclean Request</SelectItem>
                      <SelectItem value="damage">Vehicle Damage</SelectItem>
                      <SelectItem value="billing">Payment / Refund</SelectItem>
                      <SelectItem value="subscription">Subscription</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Priority</Label>
                  <Select
                    value={createForm.priority}
                    onValueChange={(val) => setCreateForm({ ...createForm, priority: val })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Case Title *</Label>
                <Input
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  placeholder="e.g. Water spots left on windshield"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Complaint Description *</Label>
                <Textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="Detail the customer concern..."
                  rows={3}
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setCreateTicketOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => createTicketMutation.mutate()}
                disabled={
                  createTicketMutation.isPending ||
                  !createForm.customerId ||
                  !createForm.title.trim() ||
                  !createForm.description.trim()
                }
              >
                {createTicketMutation.isPending ? "Creating..." : "Create Case"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
