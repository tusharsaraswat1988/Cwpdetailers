import {
  TrendingUp,
  CheckCircle,
  Clock,
  AlertTriangle,
  Camera,
  ShieldCheck,
  Calendar,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Props = {
  totalAssigned: number;
  completedCount: number;
  pendingCount: number;
  exceptionCount: number;
  verifiedServerCount?: number;
  localCachedCount?: number;
  photoComplianceCount?: number;
  attendanceDays?: number;
  className?: string;
};

export function StaffProductivityCard({
  totalAssigned,
  completedCount,
  pendingCount,
  exceptionCount,
  verifiedServerCount = 0,
  localCachedCount = 0,
  photoComplianceCount = 0,
  attendanceDays,
  className,
}: Props) {
  const completionRate = totalAssigned > 0 ? Math.round((completedCount / totalAssigned) * 100) : 0;

  return (
    <div
      className={`rounded-2xl border border-border bg-card p-4 shadow-sm space-y-4 staff-elevated ${className ?? ""}`}
      data-testid="staff-productivity-card"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm text-foreground">Field Execution Productivity</h3>
        </div>
        <Badge
          variant="outline"
          className="border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs font-semibold"
        >
          {completionRate}% Completion Rate
        </Badge>
      </div>

      {/* PROGRESS TRACK */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Overall Daily Effort</span>
          <span className="font-semibold text-foreground">
            {completedCount} / {totalAssigned} Tasks Complete
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-600 transition-all duration-500"
            style={{ width: `${completionRate}%` }}
          />
        </div>
      </div>

      {/* METRIC BREAKDOWN GRID */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-muted/40 p-2.5 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Verified Server Visits</span>
            <ShieldCheck size={13} className="text-emerald-600" />
          </div>
          <p className="text-base font-bold font-display text-foreground">{verifiedServerCount}</p>
          <p className="text-[10px] text-muted-foreground">Synced to central database</p>
        </div>

        <div className="rounded-xl bg-muted/40 p-2.5 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Field Local Records</span>
            <Sparkles size={13} className="text-blue-600" />
          </div>
          <p className="text-base font-bold font-display text-foreground">{localCachedCount}</p>
          <p className="text-[10px] text-muted-foreground">Saved locally on device (IST)</p>
        </div>

        <div className="rounded-xl bg-muted/40 p-2.5 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Photo Proof Captured</span>
            <Camera size={13} className="text-primary" />
          </div>
          <p className="text-base font-bold font-display text-foreground">{photoComplianceCount}</p>
          <p className="text-[10px] text-muted-foreground">Plate &amp; service photos</p>
        </div>

        <div className="rounded-xl bg-muted/40 p-2.5 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Exceptions Logged</span>
            <AlertTriangle size={13} className="text-orange-600" />
          </div>
          <p className="text-base font-bold font-display text-foreground">{exceptionCount}</p>
          <p className="text-[10px] text-muted-foreground">Absent / gate / skip reports</p>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground/80 italic">
        Note: Metrics distinguish authoritative backend records from locally stored daily cleaning logs.
      </p>
    </div>
  );
}
