import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccountScope } from "@/lib/account-scope";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NoCustomerProfileMessage } from "@/components/shared/NoCustomerProfileMessage";
import { useToast } from "@/hooks/use-toast";
import { Plus, MessageSquare, Send, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { SupervisorContactCard } from "@/components/shared/SupervisorContactCard";
import { staffEcosystemApi, STAFF_ECOSYSTEM_QUERY_KEY } from "@/lib/staff-ecosystem/api";
import { supportApi, type SupportTicket } from "@/lib/support/api";
import {
  CustomerPage,
  CustomerHeader,
  CustomerEmptyState,
  CustomerErrorState,
  CustomerSkeleton,
  CustomerButton,
} from "@/features/customer-ds";

const statusConfig: Record<string, { label: string; color: string }> = {
  open: { label: "Open", color: "bg-red-500/10 text-red-600 border-red-500/20" },
  assigned: { label: "Assigned", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  in_progress: { label: "In Progress", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  awaiting_customer: { label: "Action Required", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  resolved: { label: "Resolved", color: "bg-green-500/10 text-green-600 border-green-500/20" },
  closed: { label: "Closed", color: "bg-muted text-muted-foreground border-muted" },
};

const categoryLabels: Record<string, string> = {
  quality: "Service Quality",
  reclean: "Reclean Request",
  missed: "Missed Cleaning",
  billing: "Billing & Payment",
  subscription: "Subscription Issue",
  damage: "Damage Claim",
  delay: "Delay in Service",
  other: "General Support",
};

export default function CustomerComplaints() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { customerId, isLoading: scopeLoading, missingCustomerLink } = useAccountScope();

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");

  const [form, setForm] = useState({
    type: "quality",
    priority: "medium",
    title: "",
    description: "",
    photoUrl: "",
  });

  const { data: ticketsData, isLoading, isError, refetch } = useQuery({
    queryKey: ["customer-support-tickets", customerId],
    queryFn: () => supportApi.listTickets({ customerId: customerId ?? undefined }),
    enabled: customerId != null,
  });

  const { data: activeTicket, isLoading: detailLoading, refetch: refetchDetail } = useQuery({
    queryKey: ["customer-support-ticket-detail", selectedTicketId],
    queryFn: () => supportApi.getTicket(selectedTicketId!),
    enabled: selectedTicketId != null,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) =>
      supportApi.createTicket({
        customerId: customerId ?? undefined,
        ...data,
      }),
    onSuccess: (newTicket) => {
      qc.invalidateQueries({ queryKey: ["customer-support-tickets"] });
      setCreateOpen(false);
      setForm({ type: "quality", priority: "medium", title: "", description: "", photoUrl: "" });
      toast({
        title: "Support request submitted",
        description: `Ticket ${newTicket.ticketNumber} created. Our operations team is reviewing it.`,
      });
      setSelectedTicketId(newTicket.id);
    },
    onError: (err: any) => {
      toast({
        title: "Failed to submit request",
        description: err.message || "An unexpected error occurred",
        variant: "destructive",
      });
    },
  });

  const replyMutation = useMutation({
    mutationFn: (msg: string) =>
      supportApi.addMessage(selectedTicketId!, { message: msg }),
    onSuccess: () => {
      setReplyText("");
      refetchDetail();
      qc.invalidateQueries({ queryKey: ["customer-support-tickets"] });
      toast({ title: "Reply sent to support team" });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to send message",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const { data: supervisorData } = useQuery({
    queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, "customer-supervisor"],
    queryFn: staffEcosystemApi.getCustomerSupervisorContact,
    enabled: customerId != null,
  });

  const tickets = ticketsData?.data ?? [];

  return (
    <CustomerLayout>
      {scopeLoading ? (
        <CustomerPage>
          <CustomerSkeleton className="h-8 w-48" />
          <CustomerSkeleton className="h-24" />
        </CustomerPage>
      ) : missingCustomerLink || customerId == null ? (
        <CustomerPage>
          <CustomerEmptyState
            title="Account not linked"
            description="Your login is not linked to a customer profile yet."
            action={<NoCustomerProfileMessage />}
            hint=""
          />
        </CustomerPage>
      ) : (
        <CustomerPage>
          <SupervisorContactCard
            supervisor={supervisorData?.supervisor}
            title="Your Field Supervisor"
            description="For urgent service issues, you can contact your supervisor directly. Support tickets are also routed to them automatically."
            whatsAppMessage="Hi, I have a service issue I'd like to discuss."
          />

          <CustomerHeader
            title="Support & Service Requests"
            subtitle="Submit inquiries, report missed cleanings, or request recleaning"
            actions={
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <CustomerButton data-testid="btn-file-complaint">
                    <Plus size={15} className="mr-1.5" /> New Request
                  </CustomerButton>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Submit a Support Request</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-2">
                    <div>
                      <Label>Category</Label>
                      <Select
                        value={form.type}
                        onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
                      >
                        <SelectTrigger className="mt-1 h-11" data-testid="select-complaint-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="quality">Service Quality (Streaks, Dirt, Missed spots)</SelectItem>
                          <SelectItem value="reclean">Request Reclean</SelectItem>
                          <SelectItem value="missed">Missed Cleaning Visit</SelectItem>
                          <SelectItem value="subscription">Subscription / Schedule Issue</SelectItem>
                          <SelectItem value="billing">Billing & Payment</SelectItem>
                          <SelectItem value="damage">Damage Inspection</SelectItem>
                          <SelectItem value="other">General Inquiry</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Priority</Label>
                      <Select
                        value={form.priority}
                        onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}
                      >
                        <SelectTrigger className="mt-1 h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low (General question)</SelectItem>
                          <SelectItem value="medium">Medium (Standard request)</SelectItem>
                          <SelectItem value="high">High (Needs same-day attention)</SelectItem>
                          <SelectItem value="urgent">Urgent (Immediate assistance required)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Title / Summary</Label>
                      <Input
                        data-testid="input-complaint-title"
                        value={form.title}
                        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                        className="mt-1 h-11"
                        placeholder="Brief summary of the issue"
                      />
                    </div>

                    <div>
                      <Label>Detailed Description</Label>
                      <Textarea
                        data-testid="input-complaint-description"
                        value={form.description}
                        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                        className="mt-1"
                        rows={4}
                        placeholder="Please describe what happened, vehicle location, or any specific instructions..."
                      />
                    </div>

                    <CustomerButton
                      onClick={() => createMutation.mutate(form)}
                      disabled={createMutation.isPending || !form.title.trim() || !form.description.trim()}
                      className="w-full"
                      data-testid="btn-submit-complaint"
                    >
                      {createMutation.isPending ? "Submitting..." : "Submit Support Request"}
                    </CustomerButton>
                  </div>
                </DialogContent>
              </Dialog>
            }
          />

          {isError ? (
            <CustomerErrorState onRetry={() => refetch()} />
          ) : isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <CustomerSkeleton key={i} className="h-24" />
              ))}
            </div>
          ) : tickets.length === 0 ? (
            <CustomerEmptyState
              icon={<MessageSquare size={20} />}
              title="No support tickets"
              description="Having an issue with your daily cleaning or booking? Let us know and we'll make it right."
              action={
                <CustomerButton onClick={() => setCreateOpen(true)}>Submit a Request</CustomerButton>
              }
            />
          ) : (
            <div className="space-y-3">
              {tickets.map((t) => {
                const sConf = statusConfig[t.status] ?? statusConfig.open;
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTicketId(t.id)}
                    className="p-4 rounded-xl border border-border bg-card hover:border-primary/40 cursor-pointer transition-colors"
                    data-testid={`complaint-${t.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-semibold text-primary">
                            {t.ticketNumber}
                          </span>
                          <Badge variant="outline" className={`text-xs ${sConf.color}`}>
                            {sConf.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground font-medium">
                            {categoryLabels[t.type] || t.type}
                          </span>
                        </div>
                        <h4 className="font-semibold text-sm pt-0.5">{t.title}</h4>
                        {t.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {t.description}
                          </p>
                        )}
                      </div>

                      <div className="text-right flex-shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {new Date(t.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      </div>
                    </div>

                    {t.resolution && (
                      <div className="mt-3 text-xs bg-green-500/10 text-green-700 dark:text-green-300 p-2.5 rounded-lg flex items-start gap-2">
                        <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-semibold">Resolution: </span>
                          {t.resolution}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Ticket Detail & Thread Sheet */}
          <Sheet open={selectedTicketId != null} onOpenChange={(open) => !open && setSelectedTicketId(null)}>
            <SheetContent className="sm:max-w-lg flex flex-col h-full">
              {activeTicket ? (
                <>
                  <SheetHeader className="border-b pb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-primary">
                        {activeTicket.ticketNumber}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${statusConfig[activeTicket.status]?.color ?? ""}`}
                      >
                        {statusConfig[activeTicket.status]?.label ?? activeTicket.status}
                      </Badge>
                    </div>
                    <SheetTitle className="text-base text-left pt-1">
                      {activeTicket.title}
                    </SheetTitle>
                    <SheetDescription className="text-left text-xs">
                      Category: {categoryLabels[activeTicket.type] || activeTicket.type} · Created{" "}
                      {new Date(activeTicket.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </SheetDescription>
                  </SheetHeader>

                  <div className="flex-1 overflow-y-auto py-4 space-y-3">
                    {/* Resolution Banner */}
                    {activeTicket.resolution && (
                      <div className="bg-green-500/10 border border-green-500/20 text-green-800 dark:text-green-300 p-3 rounded-lg text-xs space-y-1">
                        <div className="font-semibold flex items-center gap-1.5">
                          <CheckCircle2 size={14} /> Resolved by CWP Operations
                        </div>
                        <p>{activeTicket.resolution}</p>
                      </div>
                    )}

                    {/* Messages Thread */}
                    {(activeTicket.messages ?? []).map((m) => {
                      const isCustomer = m.senderType === "customer";
                      return (
                        <div
                          key={m.id}
                          className={`flex flex-col ${
                            isCustomer ? "items-end" : "items-start"
                          }`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs shadow-sm ${
                              isCustomer
                                ? "bg-primary text-primary-foreground rounded-br-xs"
                                : "bg-muted text-foreground border rounded-bl-xs"
                            }`}
                          >
                            <div className="text-[10px] font-semibold opacity-75 mb-0.5">
                              {m.senderName}
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

                  {/* Reply Input Area */}
                  {activeTicket.status !== "closed" ? (
                    <div className="pt-3 border-t flex gap-2">
                      <Input
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Type an update or reply..."
                        className="text-xs h-9"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey && replyText.trim()) {
                            e.preventDefault();
                            replyMutation.mutate(replyText);
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        disabled={replyMutation.isPending || !replyText.trim()}
                        onClick={() => replyMutation.mutate(replyText)}
                        className="h-9 px-3"
                      >
                        <Send size={14} />
                      </Button>
                    </div>
                  ) : (
                    <div className="pt-3 border-t text-center text-xs text-muted-foreground">
                      This ticket is closed. Submit a new request if you need further help.
                    </div>
                  )}
                </>
              ) : (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  Loading ticket...
                </div>
              )}
            </SheetContent>
          </Sheet>
        </CustomerPage>
      )}
    </CustomerLayout>
  );
}
