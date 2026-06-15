import { Badge } from "@/components/ui/badge";
import type { StaffRoleAssignment } from "@/lib/staff-ecosystem/api";
import { Briefcase } from "lucide-react";

const SKILL_LABELS: Record<string, string> = {
  trainee: "Trainee",
  basic: "Basic",
  intermediate: "Intermediate",
  expert: "Expert",
};

export function StaffOperationalRoles({ roles }: { roles: StaffRoleAssignment[] }) {
  if (roles.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        No operational roles assigned yet. Contact your supervisor.
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4 space-y-3" data-testid="staff-operational-roles">
      <div className="flex items-center gap-2">
        <Briefcase size={16} className="text-primary" />
        <p className="font-semibold text-sm">My Roles & Skills</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {roles.map(r => (
          <Badge key={r.roleId} variant="outline" className="text-xs py-1 px-2">
            {r.roleName}
            <span className="text-muted-foreground ml-1.5">· {SKILL_LABELS[r.skillLevel] ?? r.skillLevel}</span>
          </Badge>
        ))}
      </div>
    </section>
  );
}
