import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { fetchCustomerComplaints } from "../api";

type Props = {
  customerId: number;
  complaintsAdminPath?: string;
};

const statusColor: Record<string, string> = {
  open: "text-amber-500 border-amber-500/30",
  in_progress: "text-blue-500 border-blue-500/30",
  resolved: "text-green-500 border-green-500/30",
  closed: "text-muted-foreground",
};

async function patchComplaint(id: number, status: string) {
  const res = await fetch(`/api/complaints/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Update failed");
  }
  return res.json();
}

export function CustomerComplaintsPanel({ customerId, complaintsAdminPath = "/admin/complaints" }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["customer-complaints", customerId],
    queryFn: () => fetchCustomerComplaints(customerId),
    enabled: customerId > 0,
  });

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => patchComplaint(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-complaints", customerId] });
      toast({ title: "Complaint updated" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const complaints = data?.data ?? [];

  return (
    <Card data-testid="customer-complaints-panel">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertCircle size={16} className="text-primary" /> Support & complaints
        </CardTitle>
        <Link href={`${complaintsAdminPath}?customerId=${customerId}`}>
          <Button variant="ghost" size="sm" className="h-7 text-xs" data-testid="btn-open-complaints-admin">
            <ExternalLink size={12} className="mr-1" /> All complaints
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : complaints.length === 0 ? (
          <p className="text-sm text-muted-foreground">No complaints filed for this customer</p>
        ) : (
          <div className="space-y-2">
            {complaints.map((c: {
              id: number;
              title: string;
              type?: string;
              status: string;
              priority?: string;
              createdAt: string;
            }) => (
              <div key={c.id} className="p-3 rounded-lg border border-border" data-testid={`customer-complaint-${c.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{c.title}</p>
                    <p className="text-xs text-muted-foreground capitalize mt-0.5">{c.type?.replace(/_/g, " ") ?? "General"}</p>
                  </div>
                  <Badge variant="outline" className={`text-xs capitalize ${statusColor[c.status] ?? ""}`}>{c.status.replace(/_/g, " ")}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(c.createdAt).toLocaleDateString("en-IN")}
                  {c.priority ? ` · ${c.priority} priority` : ""}
                </p>
                {c.status === "open" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 h-7 text-xs"
                    disabled={updateMut.isPending}
                    onClick={() => updateMut.mutate({ id: c.id, status: "in_progress" })}
                    data-testid={`btn-complaint-start-${c.id}`}
                  >
                    Mark in progress
                  </Button>
                )}
                {c.status === "in_progress" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 h-7 text-xs"
                    disabled={updateMut.isPending}
                    onClick={() => updateMut.mutate({ id: c.id, status: "resolved" })}
                    data-testid={`btn-complaint-resolve-${c.id}`}
                  >
                    Mark resolved
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
