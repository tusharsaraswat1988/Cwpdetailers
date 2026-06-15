import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, ShieldX, Clock } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; icon: typeof ShieldCheck; className: string; message: string }> = {
  verified: {
    label: "Verified",
    icon: ShieldCheck,
    className: "border-green-500/30 bg-green-500/5 text-green-700",
    message: "Your profile is verified. You are eligible for job assignments.",
  },
  pending: {
    label: "Pending verification",
    icon: Clock,
    className: "border-amber-500/30 bg-amber-500/5 text-amber-800",
    message: "Admin is reviewing your profile. Some features may be limited until verified.",
  },
  rejected: {
    label: "Verification rejected",
    icon: ShieldX,
    className: "border-destructive/30 bg-destructive/5 text-destructive",
    message: "Your profile was rejected. Update documents and contact your supervisor.",
  },
  suspended: {
    label: "Suspended",
    icon: ShieldAlert,
    className: "border-destructive/30 bg-destructive/10 text-destructive",
    message: "Your account is suspended. Contact your supervisor or admin.",
  },
};

export function StaffVerificationBanner({
  status,
  notes,
}: {
  status: string;
  notes?: string | null;
}) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const Icon = config.icon;

  if (status === "verified") return null;

  return (
    <div className={`rounded-2xl border p-4 ${config.className}`} data-testid="staff-verification-banner">
      <div className="flex items-start gap-3">
        <Icon size={18} className="shrink-0 mt-0.5" />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm">{config.message}</p>
            <Badge variant="outline" className="text-[10px] capitalize">{config.label}</Badge>
          </div>
          {notes && status === "rejected" && (
            <p className="text-xs mt-1 opacity-80">Reason: {notes}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function StaffVerificationBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const variant = status === "verified" ? "outline" : status === "suspended" || status === "rejected" ? "destructive" : "secondary";
  return (
    <Badge variant={variant} className="text-[10px] capitalize" data-testid="staff-verification-badge">
      {config.label}
    </Badge>
  );
}
