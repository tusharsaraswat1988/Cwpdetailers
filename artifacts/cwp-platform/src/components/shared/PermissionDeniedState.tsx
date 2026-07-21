import { Link } from "wouter";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PermissionDeniedStateProps {
  title?: string;
  description?: string;
  homeHref?: string;
}

export function PermissionDeniedState({
  title = "You don't have access to this",
  description = "Ask an administrator to grant permission for this section, or return to the dashboard.",
  homeHref = "/admin/dashboard",
}: PermissionDeniedStateProps) {
  return (
    <div
      className="admin-state flex flex-col items-center justify-center gap-1 px-6 py-14 text-center"
      data-testid="permission-denied-state"
      role="alert"
    >
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--tone-warning,38_92%_50%)/0.1)] text-[hsl(var(--tone-warning-fg,32_90%_32%))]">
        <ShieldAlert size={18} aria-hidden />
      </div>
      <h3 className="admin-state-title font-medium text-foreground">{title}</h3>
      <p className="admin-state-desc mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      <div className="admin-state-actions mt-4 flex flex-wrap justify-center gap-2">
        <Link href={homeHref}>
          <Button type="button" variant="outline">
            Back to dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default PermissionDeniedState;
