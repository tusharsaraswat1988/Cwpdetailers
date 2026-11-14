import { useState } from "react";
import { Link } from "wouter";
import {
  Car,
  Navigation,
  Phone,
  Building2,
  Copy,
  Check,
  Sparkles,
  MapPin,
  Clock,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { buildNavigateUrl, openExternalNavigation } from "@/lib/maps";
import { Capacitor } from "@capacitor/core";

export type NextTaskData = {
  type: "daily_clean" | "booking";
  id: string | number;
  subscriptionId?: number;
  customerName: string;
  customerPhone?: string | null;
  vehicleNumber?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleColor?: string | null;
  societyName?: string | null;
  towerName?: string | null;
  flatNumber?: string | null;
  parkingLevel?: string | null;
  parkingBay?: string | null;
  address?: string | null;
  location?: { latitude: number; longitude: number } | null;
  serviceName?: string | null;
  scheduledTime?: string | null;
  status?: string;
  notes?: string | null;
};

type Props = {
  task: NextTaskData;
  onAction?: () => void;
  actionLabel?: string;
};

export function NextTaskCard({ task, onAction, actionLabel = "Start Clean" }: Props) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const navUrl = buildNavigateUrl({
    latitude: task.location?.latitude,
    longitude: task.location?.longitude,
    address: task.address ?? (task.societyName ? `${task.societyName}` : undefined),
  });

  const fullLocationText = [
    task.societyName,
    task.towerName && `Tower ${task.towerName}`,
    task.flatNumber && `Flat ${task.flatNumber}`,
    task.parkingLevel,
    task.parkingBay && `Bay ${task.parkingBay}`,
    task.address,
  ]
    .filter(Boolean)
    .join(", ");

  const handleCopyAddress = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!fullLocationText) return;
    navigator.clipboard.writeText(fullLocationText);
    setCopied(true);
    toast({ title: "Address copied", description: fullLocationText });
    setTimeout(() => setCopied(false), 2000);
  };

  const isDaily = task.type === "daily_clean";

  return (
    <div
      className="rounded-2xl border-2 border-primary/30 bg-card p-4 shadow-sm hover:border-primary/50 transition-all space-y-3.5 staff-elevated"
      data-testid="staff-next-task-card"
    >
      {/* HEADER: BADGE & SERVICE TYPE */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            Up Next • Priority Task
          </span>
        </div>
        <Badge
          variant="outline"
          className="text-[11px] font-semibold border-primary/20 bg-primary/5 text-primary"
        >
          {isDaily ? "Daily Clean" : (task.serviceName ?? "Service Job")}
          {task.scheduledTime ? ` • ${task.scheduledTime}` : ""}
        </Badge>
      </div>

      {/* VEHICLE & CUSTOMER DETAILS */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {task.vehicleNumber ? (
            <h3 className="font-display font-extrabold text-2xl tracking-tight text-foreground truncate">
              {task.vehicleNumber}
            </h3>
          ) : (
            <h3 className="font-display font-bold text-xl tracking-tight text-foreground truncate">
              {task.customerName}
            </h3>
          )}

          <p className="text-sm font-semibold text-foreground/90 truncate mt-0.5">
            {task.customerName}
          </p>

          {(task.vehicleMake || task.vehicleModel) && (
            <p className="text-xs text-muted-foreground truncate">
              {task.vehicleMake} {task.vehicleModel}
              {task.vehicleColor ? ` · ${task.vehicleColor}` : ""}
            </p>
          )}
        </div>

        {task.parkingBay && (
          <div className="shrink-0 text-center rounded-xl bg-primary px-3 py-1.5 text-primary-foreground shadow-sm">
            <span className="block text-[10px] uppercase font-bold tracking-wider opacity-85">
              Bay
            </span>
            <span className="font-mono text-base font-extrabold leading-none">
              {task.parkingBay}
            </span>
          </div>
        )}
      </div>

      {/* LOCATION & PARKING DETAILS */}
      {(task.societyName || task.address || task.towerName) && (
        <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-2.5 text-xs text-blue-950 dark:text-blue-200 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0 font-medium truncate">
              <Building2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              <span className="font-bold truncate">{task.societyName || "Site Address"}</span>
              {task.towerName && <span className="truncate">• {task.towerName}</span>}
              {task.parkingLevel && <span className="truncate">• {task.parkingLevel}</span>}
            </div>

            {fullLocationText && (
              <button
                type="button"
                onClick={handleCopyAddress}
                className="shrink-0 p-1 text-blue-700 hover:text-blue-900 rounded hover:bg-blue-500/20"
                title="Copy Address"
              >
                {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
              </button>
            )}
          </div>

          {task.address && !task.societyName && (
            <p className="text-[11px] text-muted-foreground truncate">{task.address}</p>
          )}

          {task.notes && (
            <p className="text-[11px] italic text-muted-foreground pt-0.5">
              Note: {task.notes}
            </p>
          )}
        </div>
      )}

      {/* QUICK ACTIONS ROW: DIRECTIONS, CALL, AND PRIMARY CTA */}
      <div className="flex items-center gap-2 pt-1">
        {navUrl && (
          <a
            href={navUrl}
            target="_blank"
            rel="noreferrer"
            onClick={e => {
              if (Capacitor.isNativePlatform()) {
                e.preventDefault();
                openExternalNavigation(navUrl);
              }
            }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-11 rounded-xl border border-primary/30 bg-primary/10 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
            data-testid="next-task-navigate-btn"
          >
            <Navigation size={14} />
            <span>Navigate</span>
          </a>
        )}

        {task.customerPhone && (
          <a
            href={`tel:${task.customerPhone}`}
            className="inline-flex items-center justify-center gap-1.5 h-11 px-3.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors"
            data-testid="next-task-call-btn"
          >
            <Phone size={14} className="text-emerald-600" />
            <span className="hidden sm:inline">Call</span>
          </a>
        )}

        {onAction ? (
          <Button
            className="flex-1 h-11 text-xs font-semibold shadow-sm"
            onClick={onAction}
            data-testid="next-task-primary-btn"
          >
            <Sparkles size={14} className="mr-1.5" />
            {actionLabel}
          </Button>
        ) : isDaily ? (
          <Link
            href="/staff/daily-clean"
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-11 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
            data-testid="next-task-route-link"
          >
            <span>Open Route</span>
            <ArrowRight size={14} />
          </Link>
        ) : (
          <Link
            href={`/staff/bookings?job=booking-${task.id}`}
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-11 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
            data-testid="next-task-booking-link"
          >
            <span>Open Job</span>
            <ArrowRight size={14} />
          </Link>
        )}
      </div>
    </div>
  );
}
