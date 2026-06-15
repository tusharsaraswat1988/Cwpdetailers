import { Link } from "wouter";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, AlertTriangle } from "lucide-react";
import type { ProfileCompletion } from "@/lib/staff-ecosystem/api";

export function StaffProfileCompletionBanner({ completion, compact }: { completion: ProfileCompletion; compact?: boolean }) {
  if (completion.percent >= 100) return null;

  const items = [
    { label: "Identity", ok: completion.identityComplete },
    { label: "Documents", ok: completion.documentsComplete },
    { label: "Bank", ok: completion.bankComplete },
    { label: "Address", ok: completion.addressComplete },
  ];

  return (
    <div
      className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3"
      data-testid="staff-profile-completion-banner"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Profile {completion.percent}% complete</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Complete your profile so admin can verify you for assignments.
          </p>
        </div>
        {!compact && (
          <Link href="/staff/profile" className="text-xs text-primary font-medium shrink-0">
            Complete →
          </Link>
        )}
      </div>
      <Progress value={completion.percent} className="h-1.5" />
      <div className="flex flex-wrap gap-3 text-[10px]">
        {items.map(i => (
          <span key={i.label} className={`flex items-center gap-1 ${i.ok ? "text-green-600" : "text-muted-foreground"}`}>
            {i.ok ? <CheckCircle2 size={11} /> : <Circle size={11} />}
            {i.label}
          </span>
        ))}
      </div>
    </div>
  );
}
