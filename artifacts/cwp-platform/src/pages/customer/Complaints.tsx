import { useState } from "react";
import { useListComplaints, getListComplaintsQueryKey, useCreateComplaint } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccountScope } from "@/lib/account-scope";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { NoCustomerProfileMessage } from "@/components/shared/NoCustomerProfileMessage";
import { useToast } from "@/hooks/use-toast";
import { Plus, MessageSquare } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { SupervisorContactCard } from "@/components/shared/SupervisorContactCard";
import { staffEcosystemApi, STAFF_ECOSYSTEM_QUERY_KEY } from "@/lib/staff-ecosystem/api";
import {
  CustomerPage,
  CustomerHeader,
  CustomerEmptyState,
  CustomerErrorState,
  CustomerSkeleton,
  CustomerButton,
  CustomerSupportCard,
  CustomerStatusBadge,
} from "@/features/customer-ds";

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

  const { data: supervisorData } = useQuery({
    queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, "customer-supervisor"],
    queryFn: staffEcosystemApi.getCustomerSupervisorContact,
    enabled: customerId != null,
  });

  const fileComplaintDialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <CustomerButton data-testid="btn-file-complaint">
          <Plus size={15} className="mr-1.5" /> New Complaint
        </CustomerButton>
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
          <CustomerButton
            onClick={() => createMutation.mutate({ data: { customerId, ...form, type: form.type as any } })}
            disabled={createMutation.isPending || !form.title || !form.description}
            className="w-full"
            data-testid="btn-submit-complaint"
          >
            {createMutation.isPending ? "Filing..." : "Submit Complaint"}
          </CustomerButton>
        </div>
      </DialogContent>
    </Dialog>
  );

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
            description="For urgent service issues, you can contact your supervisor directly. Complaints are also routed to them automatically."
            whatsAppMessage="Hi, I have a service issue I'd like to discuss."
          />

          <CustomerHeader
            title="Support"
            subtitle="Report issues with our services"
            actions={fileComplaintDialog}
          />

          {isError ? (
            <CustomerErrorState onRetry={() => refetch()} />
          ) : isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <CustomerSkeleton key={i} className="h-24" />
              ))}
            </div>
          ) : (data?.data ?? []).length === 0 ? (
            <CustomerEmptyState
              icon={<MessageSquare size={20} />}
              title="No complaints filed"
              description="Having an issue with a service? Let us know and we'll make it right."
              action={
                <CustomerButton onClick={() => setOpen(true)}>File a Complaint</CustomerButton>
              }
            />
          ) : (
            <div className="space-y-3">
              {(data?.data ?? []).map(c => (
                <div key={c.id} data-testid={`complaint-${c.id}`}>
                  <CustomerSupportCard
                    title={c.title}
                    description={c.description ?? undefined}
                    actions={
                      <div className="space-y-2">
                        {c.resolution && (
                          <p className="text-xs text-primary bg-primary/5 px-2 py-1 rounded">
                            ✓ {c.resolution}
                          </p>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground">{new Date(c.createdAt!).toLocaleDateString("en-IN")}</p>
                          <CustomerStatusBadge status={c.status ?? "open"} />
                        </div>
                      </div>
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </CustomerPage>
      )}
    </CustomerLayout>
  );
}
