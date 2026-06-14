import { useQuery } from "@tanstack/react-query";
import StaffAppShell from "@/components/layout/StaffAppShell";
import { StaffAccountGate } from "@/components/staff/StaffAccountGate";
import { useAccountScope } from "@/lib/account-scope";
import { staffEcosystemApi, STAFF_ECOSYSTEM_QUERY_KEY } from "@/lib/staff-ecosystem/api";
import { SupervisorContactCard } from "@/components/shared/SupervisorContactCard";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, AlertCircle, Phone } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";

export default function StaffTeam() {
  const { staffId, isLoading: scopeLoading, missingStaffLink } = useAccountScope();

  const { data: ctx, isLoading } = useQuery({
    queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, "me-context"],
    queryFn: staffEcosystemApi.getMyContext,
    enabled: staffId != null,
  });

  const { data: complaints, isLoading: loadingComplaints } = useQuery({
    queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, "team-complaints"],
    queryFn: staffEcosystemApi.getMyTeamComplaints,
    enabled: staffId != null && ctx?.staffCategory === "supervisor",
  });

  if (scopeLoading || missingStaffLink || staffId == null) {
    return (
      <StaffAccountGate scopeLoading={scopeLoading} missingStaffLink={missingStaffLink} staffId={staffId}>
        {null}
      </StaffAccountGate>
    );
  }

  if (isLoading || !ctx) {
    return (
      <StaffAppShell>
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </StaffAppShell>
    );
  }

  if (ctx.staffCategory !== "supervisor") {
    return (
      <StaffAppShell>
        <div className="space-y-4">
          <SupervisorContactCard
            supervisor={ctx.reportingManager}
            title="Your Supervisor"
            description="Reach out for field issues, escalations, or support during your shift."
            whatsAppMessage={`Hi ${ctx.reportingManager?.name ?? "Supervisor"}, I need assistance regarding my work.`}
          />
        </div>
      </StaffAppShell>
    );
  }

  return (
    <StaffAppShell>
      <div className="space-y-5 pb-4">
        <div>
          <h1 className="font-display font-bold text-xl">My Team</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {ctx.directReports.length} cleaning staff under your supervision
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users size={16} className="text-primary" />
            <p className="font-semibold text-sm">Direct Reports</p>
          </div>
          {ctx.directReports.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cleaning staff assigned to you yet.</p>
          ) : (
            <div className="space-y-2">
              {ctx.directReports.map(member => (
                <div key={member.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.employeeCode ?? `ID ${member.id}`}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={member.isActive ? "outline" : "secondary"} className="text-[10px]">
                      {member.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <a
                      href={`tel:${member.phone}`}
                      className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border hover:bg-muted"
                      aria-label={`Call ${member.name}`}
                    >
                      <Phone size={14} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-destructive" />
              <p className="font-semibold text-sm">Customer Complaints</p>
            </div>
            {ctx.openTeamComplaints > 0 && (
              <Badge variant="destructive">{ctx.openTeamComplaints} open</Badge>
            )}
          </div>
          {loadingComplaints ? (
            <Skeleton className="h-20 w-full" />
          ) : (complaints ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No complaints routed to you.</p>
          ) : (
            <div className="space-y-2">
              {(complaints ?? []).slice(0, 10).map(c => (
                <div key={c.id} className="p-3 rounded-xl border border-border space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm">{c.title}</p>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">
                    {c.type.replace(/_/g, " ")} · {new Date(c.createdAt).toLocaleDateString("en-IN")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </StaffAppShell>
  );
}
