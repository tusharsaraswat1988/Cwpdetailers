import { useState, useEffect } from "react";
import { useListComplaints, getListComplaintsQueryKey, useUpdateComplaint } from "@workspace/api-client-react";
import AdminLayout from "@/components/layout/AdminLayout";
import { PageActionHeader } from "@/components/layout/PageActionHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const statusColors: Record<string, string> = {
  open: "bg-destructive/10 text-destructive border-destructive/20",
  in_progress: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  resolved: "bg-green-500/10 text-green-600 border-green-500/20",
  closed: "bg-muted text-muted-foreground border-muted",
};

const priorityColors: Record<string, string> = {
  high: "text-destructive",
  medium: "text-amber-600",
  low: "text-muted-foreground",
};

type ComplaintRow = {
  id: number;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  type?: string;
  customerName?: string;
  createdAt?: string;
  resolution?: string;
  assignedSupervisorName?: string | null;
  relatedStaffName?: string | null;
};

export default function AdminComplaints() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [customerFilter, setCustomerFilter] = useState<string | undefined>(undefined);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("customerId");
    setCustomerFilter(id ?? undefined);
  }, []);

  const { data, isLoading } = useListComplaints(
    customerFilter ? { customerId: customerFilter } as any : {},
    { query: { queryKey: getListComplaintsQueryKey(customerFilter ? { customerId: customerFilter } as any : {}) } },
  );

  const updateMutation = useUpdateComplaint({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListComplaintsQueryKey() });
        toast({ title: "Complaint updated" });
      },
    },
  });

  const openCount = (data?.data ?? []).filter((c: ComplaintRow) => c.status === "open" || c.status === "in_progress").length;

  return (
    <AdminLayout>
      <div className="p-6 space-y-5">
        <PageActionHeader
          title="Complaints"
          description={`${data?.total ?? 0} total · ${openCount} need attention${customerFilter ? ` · customer #${customerFilter}` : ""}`}
          primaryAction={{
            label: openCount > 0 ? "Review open complaints" : "All caught up",
            href: openCount > 0 ? "#complaints-list" : "/admin/dashboard",
            testId: "complaints-primary-cta",
          }}
        />

        <div id="complaints-list" className="space-y-3">
          {isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />) :
            (data?.data ?? []).map((c: ComplaintRow) => (
              <div key={c.id} className="bg-card border border-border rounded-xl p-5" data-testid={`complaint-${c.id}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={`text-xs ${statusColors[c.status ?? "open"]}`}>{c.status?.replace(/_/g, " ")}</Badge>
                      <span className={`text-xs font-medium capitalize ${priorityColors[c.priority ?? "medium"]}`}>{c.priority} priority</span>
                      <span className="text-xs text-muted-foreground capitalize">{c.type?.replace(/_/g, " ")}</span>
                    </div>
                    <p className="font-semibold text-sm">{c.title}</p>
                    <p className="text-muted-foreground text-sm mt-1">{c.description}</p>
                    {(c.assignedSupervisorName || c.relatedStaffName) && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {c.relatedStaffName && <>Field staff: {c.relatedStaffName}</>}
                        {c.relatedStaffName && c.assignedSupervisorName && " · "}
                        {c.assignedSupervisorName && <>Supervisor: {c.assignedSupervisorName}</>}
                      </p>
                    )}
                    {c.resolution && <p className="text-primary text-xs mt-1.5 bg-primary/5 px-2 py-1 rounded">Resolution: {c.resolution}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-medium">{c.customerName}</p>
                    <p className="text-xs text-muted-foreground">{new Date(c.createdAt!).toLocaleDateString("en-IN")}</p>
                    <div className="flex gap-1 mt-2 justify-end">
                      {c.status === "open" && (
                        <Button size="sm" variant="outline" className="text-xs h-7 px-2"
                          data-testid={`btn-progress-${c.id}`}
                          onClick={() => updateMutation.mutate({ id: c.id, data: { status: "in_progress" } })}>
                          In Progress
                        </Button>
                      )}
                      {(c.status === "open" || c.status === "in_progress") && (
                        <Button size="sm" className="text-xs h-7 px-2 bg-green-600 hover:bg-green-700 text-white"
                          data-testid={`btn-resolve-${c.id}`}
                          onClick={() => updateMutation.mutate({ id: c.id, data: { status: "resolved", resolution: "Resolved by admin" } })}>
                          Resolve
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          {!isLoading && (data?.data ?? []).length === 0 && <div className="text-center py-12 text-muted-foreground">No complaints found</div>}
        </div>
      </div>
    </AdminLayout>
  );
}
