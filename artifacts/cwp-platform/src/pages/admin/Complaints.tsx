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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
} from "lucide-react";
import { supportApi, type SupportTicket } from "@/lib/support/api";

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

export default function AdminComplaints() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
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

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("customerId");
    if (id) setSearch(`customer:${id}`);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-support-tickets", statusFilter, priorityFilter, search],
    queryFn: () =>
      supportApi.listTickets({
        status: statusFilter,
        priority: priorityFilter,
        search: search.trim() || undefined,
      }),
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
        title: vars.isInternal ? "Internal note recorded" : "Reply sent to customer",
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

  const tickets = data?.data ?? [];
  const openCount = tickets.filter((t) => t.status === "open" || t.status === "assigned" || t.status === "in_progress").length;
  const overdueCount = tickets.filter((t) => t.isOverdue).length;

  return (
    <AdminLayout>
      <div className="p-6 space-y-5">
        <PageActionHeader
          title="Support & Exceptions Command Center"
          description={`${data?.total ?? 0} total tickets · ${openCount} active · ${overdueCount} SLA overdue (>24h)`}
          primaryAction={{
            label: openCount > 0 ? "Triage Active Tickets" : "All Caught Up",
            href: "#support-list",
            testId: "complaints-primary-cta",
          }}
        />

        {/* Filters bar */}
        <div className="flex flex-wrap items-center gap-3 bg-card border border-border p-3 rounded-xl">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ticket #, customer, phone..."
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="w-40">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 text-xs">
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
          </div>

          <div className="w-40">
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="h-9 text-xs">
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
          </div>
        </div>

        {/* Tickets Grid */}
        <div id="support-list" className="space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))
          ) : tickets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-card border rounded-xl">
              No support tickets found matching current filters.
            </div>
          ) : (
            tickets.map((t) => {
              const pConf = priorityBadges[t.priority] ?? priorityBadges.medium;
              const sColor = statusColors[t.status] ?? statusColors.open;

              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedTicketId(t.id)}
                  className={`bg-card border rounded-xl p-5 cursor-pointer hover:border-primary/50 transition-colors ${
                    t.isOverdue ? "border-red-500/30 bg-red-500/5" : "border-border"
                  }`}
                  data-testid={`complaint-${t.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono text-xs font-bold text-primary">
                          {t.ticketNumber}
                        </span>
                        <Badge variant="outline" className={`text-xs ${sColor}`}>
                          {t.status.replace(/_/g, " ")}
                        </Badge>
                        <Badge variant="outline" className={`text-xs ${pConf.color}`}>
                          {pConf.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground capitalize">
                          {t.type.replace(/_/g, " ")}
                        </span>
                        {t.isOverdue && (
                          <Badge variant="destructive" className="text-[10px] h-5 gap-1">
                            <Clock size={11} /> SLA Overdue (&gt;24h)
                          </Badge>
                        )}
                        {t.operationalExceptionId && (
                          <Badge variant="secondary" className="text-[10px] h-5 bg-amber-500/10 text-amber-700">
                            Linked DCMS Exception #{t.operationalExceptionId}
                          </Badge>
                        )}
                      </div>

                      <p className="font-semibold text-sm">{t.title}</p>
                      {t.description && (
                        <p className="text-muted-foreground text-xs line-clamp-2">{t.description}</p>
                      )}

                      <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
                        <span>City: {t.cityName || "N/A"}</span>
                        <span>·</span>
                        <span>Branch: {t.branchName || "N/A"}</span>
                        {(t.assignedSupervisorName || t.relatedStaffName) && (
                          <>
                            <span>·</span>
                            <span>Supervisor: {t.assignedSupervisorName || "Unassigned"}</span>
                            <span>·</span>
                            <span>Cleaner: {t.relatedStaffName || "Unassigned"}</span>
                          </>
                        )}
                      </div>

                      {t.resolution && (
                        <p className="text-xs text-green-700 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded inline-block mt-2">
                          ✓ {t.resolution}
                        </p>
                      )}
                    </div>

                    <div className="text-right flex-shrink-0 space-y-2">
                      <div>
                        <p className="text-sm font-medium">{t.customerName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{t.customerPhone}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(t.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>

                      <div className="flex gap-1 justify-end">
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

                {/* Quick context pill */}
                <div className="py-2 px-3 bg-muted/40 rounded-lg text-xs space-y-1 border">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Priority: <span className="font-semibold uppercase">{activeTicket.priority}</span></span>
                    <span>Type: <span className="font-semibold capitalize">{activeTicket.type}</span></span>
                    {activeTicket.isOverdue && (
                      <span className="text-red-600 font-semibold flex items-center gap-1">
                        <AlertTriangle size={12} /> Overdue
                      </span>
                    )}
                  </div>
                  {activeTicket.operationalExceptionId && (
                    <div className="text-amber-700 dark:text-amber-300">
                      Auto-linked DCMS Exception: #{activeTicket.operationalExceptionId}
                    </div>
                  )}
                  {activeTicket.internalNotes && (
                    <div className="text-slate-600 dark:text-slate-400 bg-amber-500/10 p-1.5 rounded text-[11px]">
                      <span className="font-semibold">Internal Audit Note:</span> {activeTicket.internalNotes}
                    </div>
                  )}
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
                              className={`flex flex-col ${
                                isStaff ? "items-end" : "items-start"
                              }`}
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
                        placeholder="Type update visible to customer..."
                        className="text-xs h-9"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey && customerMessage.trim()) {
                            e.preventDefault();
                            addMessageMutation.mutate({
                              id: activeTicket.id,
                              msg: customerMessage,
                              isInternal: false,
                            });
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        disabled={addMessageMutation.isPending || !customerMessage.trim()}
                        onClick={() =>
                          addMessageMutation.mutate({
                            id: activeTicket.id,
                            msg: customerMessage,
                            isInternal: false,
                          })
                        }
                        className="h-9 px-3"
                      >
                        <Send size={14} />
                      </Button>
                    </div>
                  </TabsContent>

                  {/* Internal Shielded Notes */}
                  <TabsContent value="internal" className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-md text-[11px] text-amber-800 dark:text-amber-200 flex items-center gap-1.5 my-1">
                      <ShieldAlert size={14} />
                      <span>
                        Internal operations channel. Customer will NEVER see these messages.
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto py-2 space-y-2">
                      {(activeTicket.messages ?? [])
                        .filter((m) => m.isInternal)
                        .map((m) => (
                          <div
                            key={m.id}
                            className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between text-[11px] font-semibold text-amber-900 dark:text-amber-100">
                              <span>🔒 {m.senderName}</span>
                              <span className="text-muted-foreground font-normal">
                                {new Date(m.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            <p className="text-foreground whitespace-pre-wrap">{m.message}</p>
                          </div>
                        ))}
                    </div>

                    <div className="pt-2 border-t flex gap-2">
                      <Input
                        value={internalNote}
                        onChange={(e) => setInternalNote(e.target.value)}
                        placeholder="Add internal supervisor note..."
                        className="text-xs h-9 bg-amber-500/5 border-amber-500/30"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey && internalNote.trim()) {
                            e.preventDefault();
                            addMessageMutation.mutate({
                              id: activeTicket.id,
                              msg: internalNote,
                              isInternal: true,
                            });
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={addMessageMutation.isPending || !internalNote.trim()}
                        onClick={() =>
                          addMessageMutation.mutate({
                            id: activeTicket.id,
                            msg: internalNote,
                            isInternal: true,
                          })
                        }
                        className="h-9 px-3"
                      >
                        <Lock size={13} className="mr-1" /> Save
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </>
            ) : (
              <div className="p-6 text-center text-xs text-muted-foreground">Loading...</div>
            )}
          </SheetContent>
        </Sheet>

        {/* Resolution Dialog */}
        <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Resolve Ticket {activeTicket?.ticketNumber}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              <div>
                <Label>Resolution Action</Label>
                <Select
                  value={resolveAction}
                  onValueChange={(val: any) => setResolveAction(val)}
                >
                  <SelectTrigger className="mt-1 h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grant_makeup_credit">
                      Grant Makeup Cleaning (+1 Credit to Subscription)
                    </SelectItem>
                    <SelectItem value="schedule_reclean">
                      Schedule Recleaning Visit
                    </SelectItem>
                    <SelectItem value="reassign_staff">
                      Reassign Cleaner / Adjust Daily Route
                    </SelectItem>
                    <SelectItem value="custom_resolution">
                      Customer Reassurance / Custom Resolution
                    </SelectItem>
                    <SelectItem value="no_action_needed">
                      No Action Needed (False Alarm / Duplicate)
                    </SelectItem>
                  </SelectContent>
                </Select>
                {resolveAction === "grant_makeup_credit" && (
                  <p className="text-[11px] text-green-600 mt-1">
                    ✓ Atomically credits +1 remaining cleaning to the customer's DCMS subscription and notifies customer.
                  </p>
                )}
              </div>

              <div>
                <Label>Resolution Note (Visible to Customer)</Label>
                <Textarea
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  placeholder="Explain how the issue was resolved..."
                  rows={3}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label>Internal Operations Note (Shielded)</Label>
                <Input
                  value={resolveInternalNote}
                  onChange={(e) => setResolveInternalNote(e.target.value)}
                  placeholder="Audit reason, supervisor coaching note, etc."
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setResolveDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                disabled={resolveMutation.isPending || !resolveNote.trim()}
                onClick={() => resolveMutation.mutate()}
              >
                {resolveMutation.isPending ? "Resolving..." : "Confirm Resolution"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
