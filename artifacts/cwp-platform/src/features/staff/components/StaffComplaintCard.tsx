import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { staffEcosystemApi, STAFF_ECOSYSTEM_QUERY_KEY, type TeamComplaint } from "@/lib/staff-ecosystem/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Loader2 } from "lucide-react";

export function StaffComplaintCard({ complaint }: { complaint: TeamComplaint }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [resolution, setResolution] = useState(complaint.resolution ?? "");
  const [expanded, setExpanded] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (data: { status?: string; resolution?: string }) =>
      staffEcosystemApi.updateTeamComplaint(complaint.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, "team-complaints"] });
      qc.invalidateQueries({ queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, "me-context"] });
      toast({ title: "Complaint updated" });
      setExpanded(false);
    },
    onError: (err: Error) =>
      toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const isOpen = complaint.status === "open" || complaint.status === "in_progress";

  return (
    <div className="p-3 rounded-xl border border-border space-y-2" data-testid={`team-complaint-${complaint.id}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-sm">{complaint.title}</p>
        <StatusBadge status={complaint.status} />
      </div>
      <p className="text-xs text-muted-foreground line-clamp-3">{complaint.description}</p>
      <p className="text-[10px] text-muted-foreground capitalize">
        {complaint.type.replace(/_/g, " ")} · {complaint.priority} priority ·{" "}
        {new Date(complaint.createdAt).toLocaleDateString("en-IN")}
      </p>
      {complaint.resolution && (
        <p className="text-xs bg-muted/50 rounded-lg p-2">
          <span className="font-medium">Resolution: </span>{complaint.resolution}
        </p>
      )}

      {isOpen && (
        <>
          {!expanded ? (
            <div className="flex gap-2 pt-1">
              {complaint.status === "open" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  disabled={updateMutation.isPending}
                  onClick={() => updateMutation.mutate({ status: "in_progress" })}
                >
                  Acknowledge
                </Button>
              )}
              <Button
                size="sm"
                className="h-8 text-xs"
                disabled={updateMutation.isPending}
                onClick={() => setExpanded(true)}
              >
                Resolve
              </Button>
            </div>
          ) : (
            <div className="space-y-2 pt-1 border-t border-border">
              <Textarea
                value={resolution}
                onChange={e => setResolution(e.target.value)}
                placeholder="Describe how this was resolved…"
                className="text-sm min-h-[72px]"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  disabled={updateMutation.isPending || !resolution.trim()}
                  onClick={() =>
                    updateMutation.mutate({ status: "resolved", resolution: resolution.trim() })
                  }
                >
                  {updateMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : "Mark resolved"}
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setExpanded(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {!isOpen && complaint.status === "resolved" && (
        <Badge variant="outline" className="text-[10px] text-green-600 border-green-500/30">
          Resolved {complaint.resolvedAt ? new Date(complaint.resolvedAt).toLocaleDateString("en-IN") : ""}
        </Badge>
      )}
    </div>
  );
}
