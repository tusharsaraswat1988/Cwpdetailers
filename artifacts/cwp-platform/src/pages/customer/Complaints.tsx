import { useState } from "react";
import { useListComplaints, getListComplaintsQueryKey, useCreateComplaint } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccountScope } from "@/lib/account-scope";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { useToast } from "@/hooks/use-toast";
import { Plus, AlertCircle, MessageSquare } from "lucide-react";

export default function CustomerComplaints() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { customerId, isLoading: scopeLoading, missingCustomerLink } = useAccountScope();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: "quality", title: "", description: "" });

  const { data, isLoading, isError, refetch } = useListComplaints(
    { customerId: String(customerId ?? "") } as any,
    {
      query: {
        queryKey: getListComplaintsQueryKey({ customerId: String(customerId ?? "") } as any),
        enabled: customerId != null,
      },
    },
  );

  const createMutation = useCreateComplaint({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListComplaintsQueryKey() });
        setOpen(false);
        setForm({ type: "quality", title: "", description: "" });
        toast({ title: "Complaint filed successfully" });
      },
      onError: () => toast({ title: "Failed to file complaint", variant: "destructive" }),
    },
  });

  return (
    <CustomerLayout>
      {scopeLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      ) : missingCustomerLink || customerId == null ? (
        <div className="max-w-md mx-auto text-center space-y-2 py-12">
          <p className="font-semibold">Account not linked</p>
          <p className="text-sm text-muted-foreground">Your login is not linked to a customer profile. Contact CWP support.</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display font-bold text-2xl">Support</h1>
              <p className="text-muted-foreground text-sm mt-0.5">Report issues with our services</p>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-secondary hover:bg-primary/90" data-testid="btn-file-complaint">
                  <Plus size={15} className="mr-1.5" /> New Complaint
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>File a Complaint</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-2">
                  <div>
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                      <SelectTrigger className="mt-1 h-11" data-testid="select-complaint-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["quality", "delay", "reclean", "damage", "billing", "other"].map(t => (
                          <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Title</Label>
                    <Input data-testid="input-complaint-title" value={form.title}
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      className="mt-1 h-11" placeholder="Brief summary of the issue" />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea data-testid="input-complaint-description" value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      className="mt-1" rows={4} placeholder="Describe the issue in detail..." />
                  </div>
                  <Button
                    onClick={() => createMutation.mutate({ data: { customerId, ...form, type: form.type as any } })}
                    disabled={createMutation.isPending || !form.title || !form.description}
                    className="w-full h-11 bg-primary text-secondary hover:bg-primary/90"
                    data-testid="btn-submit-complaint">
                    {createMutation.isPending ? "Filing..." : "Submit Complaint"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : (data?.data ?? []).length === 0 ? (
            // QW-04: EmptyState
            <EmptyState
              icon={<MessageSquare size={20} />}
              title="No complaints filed"
              description="Having an issue with a service? Let us know and we'll make it right."
              action={
                <Button onClick={() => setOpen(true)}>File a Complaint</Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {(data?.data ?? []).map(c => (
                <div key={c.id} className="bg-card border border-border rounded-xl p-4" data-testid={`complaint-${c.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
                        <AlertCircle size={13} className="text-destructive" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{c.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{c.description}</p>
                        {c.resolution && (
                          <p className="text-xs text-primary mt-1.5 bg-primary/5 px-2 py-1 rounded">
                            ✓ {c.resolution}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 space-y-1">
                      {/* QW-17: StatusBadge */}
                      <StatusBadge status={c.status ?? "open"} />
                      <p className="text-xs text-muted-foreground">{new Date(c.createdAt!).toLocaleDateString("en-IN")}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </CustomerLayout>
  );
}
