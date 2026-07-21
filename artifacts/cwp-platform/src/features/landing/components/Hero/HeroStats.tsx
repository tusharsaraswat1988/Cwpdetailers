import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { LANDING_TYPE } from "../../constants";
import type { HeroStat } from "../../content/heroTypes";

export type HeroStatsProps = {
  stats: HeroStat;
  className?: string;
};

/** Floating / overlay stat card for hero media — no enter animation (stable chrome). */
export function HeroStats({ stats, className }: HeroStatsProps) {
  return (
    <div
      className={cn(
        "min-w-[190px] rounded-2xl bg-white/95 p-4 shadow-lg backdrop-blur",
        className,
      )}
      data-testid="hero-stats"
    >
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {stats.label}
      </div>
      <div
        className={cn(
          "mt-1 font-display leading-none tracking-tight",
          LANDING_TYPE.statValue,
        )}
      >
        {stats.value}
      </div>
      {stats.hint ? (
        <div className="mt-2 flex items-center gap-1 text-[11px] text-emerald-600">
          <Zap className="h-3 w-3" aria-hidden />
          {stats.hint}
        </div>
      ) : null}
    </div>
  );
}
