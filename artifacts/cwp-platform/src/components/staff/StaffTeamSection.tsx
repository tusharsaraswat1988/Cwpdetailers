import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { staffEcosystemApi, STAFF_ECOSYSTEM_QUERY_KEY } from "@/lib/staff-ecosystem/api";
import { StaffComplaintCard } from "@/features/staff/components/StaffComplaintCard";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, AlertCircle, Phone, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

type ComplaintFilter = "open" | "all";

export function StaffTeamSection() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<ComplaintFilter>("open");

  const { data: ctx, isLoading } = useQuery({
    queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, "me-context"],
    queryFn: staffEcosystemApi.getMyContext,
  });

  const { data: complaints, isLoading: loadingComplaints } = useQuery({
    queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, "team-complaints"],
    queryFn: staffEcosystemApi.getMyTeamComplaints,
    enabled: ctx?.staffCategory === "supervisor",
  });

  if (isLoading || !ctx || ctx.staffCategory !== "supervisor") return null;

  const filteredComplaints = (complaints ?? []).filter(c =>
    filter === "open" ? c.status === "open" || c.status === "in_progress" : true,
  );

  return (
    <section className="rounded-2xl border border-border overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-muted/50 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Users size={16} className="text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">My team</p>
            <p className="text-xs text-muted-foreground truncate">
              {ctx.directReports.length} staff
              {ctx.openTeamComplaints > 0 && ` · ${ctx.openTeamComplaints} open complaint${ctx.openTeamComplaints !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {ctx.openTeamComplaints > 0 && (
            <Badge variant="destructive" className="text-[10px]">{ctx.openTeamComplaints}</Badge>
          )}
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-border pt-3">
          {ctx.directReports.length === 0 ? (
            <p className="text-xs text-muted-foreground">No cleaning staff assigned yet.</p>
          ) : (
            <div className="space-y-2">
              {ctx.directReports.map(member => (
                <div key={member.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-border">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{member.name}</p>
                    <p className="text-[10px] text-muted-foreground">{member.employeeCode ?? `ID ${member.id}`}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant={member.isActive ? "outline" : "secondary"} className="text-[10px]">
                      {member.isActive ? "Active" : "Off"}
                    </Badge>
                    <a
                      href={`tel:${member.phone}`}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-border hover:bg-muted"
                      aria-label={`Call ${member.name}`}
                    >
                      <Phone size={13} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <AlertCircle size={14} className="text-destructive" />
                <p className="text-xs font-semibold">Complaints</p>
              </div>
              <div className="flex rounded-lg bg-muted p-0.5 gap-0.5">
                {(["open", "all"] as const).map(key => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    className={cn(
                      "px-2 py-0.5 rounded-md text-[10px] font-medium capitalize",
                      filter === key ? "bg-card shadow-sm" : "text-muted-foreground",
                    )}
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>
            {loadingComplaints ? (
              <Skeleton className="h-16 w-full rounded-lg" />
            ) : filteredComplaints.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {filter === "open" ? "No open complaints" : "No complaints routed to you"}
              </p>
            ) : (
              <div className="space-y-2">
                {filteredComplaints.map(c => (
                  <StaffComplaintCard key={c.id} complaint={c} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
