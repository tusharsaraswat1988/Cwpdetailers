import { Link } from "wouter";
import {
  Calendar,
  Clock,
  Car,
  CheckCircle2,
  Navigation2,
  ArrowRight,
  Sparkles,
  CalendarCheck,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { HomeOperationalHero, HomeAdaptiveCta } from "@/lib/home-dashboard";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";
import { cn } from "@/lib/utils";

interface TodayServiceCardProps {
  hero: HomeOperationalHero;
  cta?: HomeAdaptiveCta;
  hasDailyCleaningPlan?: boolean;
  className?: string;
}

export function TodayServiceCard({
  hero,
  cta,
  hasDailyCleaningPlan,
  className,
}: TodayServiceCardProps) {
  const isNoService = hero.kind === "clear" || hero.kind === "renewal_due";
  const isInProgress = hero.kind === "in_progress";
  const isEnRoute = hero.kind === "en_route";
  const isScheduled = hero.kind === "scheduled_today";
  const isCompleted = hero.kind === "feedback_due";

  if (isNoService) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-[0_2px_8px_rgba(11,29,54,0.04)] flex flex-col justify-between transition-all",
          className,
        )}
        data-testid="home-today-service-empty"
      >
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-500 border border-slate-200/60 flex items-center justify-center shrink-0">
            <Calendar size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Today's Service
            </span>
            <h3 className="font-display font-bold text-base sm:text-lg text-foreground mt-0.5">
              No Service Scheduled Today
            </h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {hasDailyCleaningPlan
                ? "Your daily cleaning team operates on their regular route timing."
                : "Book a slot for a wash, interior detailing, or maintenance visit."}
            </p>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-end">
          {hasDailyCleaningPlan ? (
            <Link
              href="/customer/daily-cleaning"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-foreground text-xs font-semibold transition-all min-h-11 w-full sm:w-auto cursor-pointer"
              data-testid="home-view-cleaning-plan"
            >
              View Cleaning Plan <ArrowRight size={13} />
            </Link>
          ) : (
            <Link
              href={CUSTOMER_ROUTES.scheduleEntry({ from: "home" })}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-semibold shadow-xs hover:bg-[#1264db] transition-all min-h-11 w-full sm:w-auto cursor-pointer"
              data-testid="home-schedule-today-cta"
            >
              Schedule Service <ArrowRight size={13} />
            </Link>
          )}
        </div>
      </div>
    );
  }

  // Active / scheduled / completed today service card
  return (
    <div
      className={cn(
        "rounded-2xl border p-5 sm:p-6 shadow-[0_2px_8px_rgba(11,29,54,0.04)] transition-all relative overflow-hidden flex flex-col justify-between",
        isInProgress
          ? "border-blue-200 bg-blue-50/40"
          : isEnRoute
            ? "border-amber-200 bg-amber-50/40"
            : isCompleted
              ? "border-emerald-200 bg-emerald-50/40"
              : "border-slate-200/90 bg-white",
        className,
      )}
      data-testid="home-today-service-card"
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                isInProgress
                  ? "bg-blue-600 text-white"
                  : isEnRoute
                    ? "bg-amber-600 text-white"
                    : isCompleted
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-800 border border-slate-200",
              )}
            >
              {isInProgress && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
              {isEnRoute && <Navigation2 size={11} className="animate-bounce" />}
              {isCompleted && <CheckCircle2 size={11} />}
              {isScheduled && <CalendarCheck size={11} />}
              {hero.eyebrow}
            </span>
            {hero.status && hero.status !== "clear" && (
              <StatusBadge status={hero.status} pulse={hero.pulse} className="shrink-0" />
            )}
          </div>

          {cta && (
            <Link
              href={cta.href}
              className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 shrink-0 cursor-pointer"
              data-testid={cta.testId}
            >
              {cta.label} <ArrowRight size={13} />
            </Link>
          )}
        </div>

        <div className="mt-3">
          <h3 className="font-display font-bold text-lg text-foreground tracking-tight leading-snug">
            {hero.title}
          </h3>
          {hero.subtitle && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1.5">
              <span className="font-medium text-foreground">{hero.subtitle}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TodayServiceCard;
