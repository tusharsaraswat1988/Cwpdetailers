import { Car, ClipboardCheck, Clock, MapPin, Shield, Star, Sun, Users, Zap } from "lucide-react";
import { LANDING_LAYOUT } from "../../constants";
import { CountUp } from "../../lib/CountUp";
import { useExperience } from "../../ExperienceProvider";

type StatItem = {
  icon: typeof Car;
  label: string;
  to: number;
  suffix?: string;
  decimals?: number;
};

const VEHICLE: StatItem[] = [
  { icon: Car, label: "Cars detailed", to: 12400, suffix: "+" },
  { icon: Users, label: "Repeat owners", to: 74, suffix: "%" },
  { icon: Clock, label: "Avg. arrival", to: 32, suffix: " min" },
  { icon: Star, label: "Owner rating", to: 4.9, decimals: 1, suffix: "/5" },
  { icon: Shield, label: "24h re-do guarantee", to: 100, suffix: "%" },
];

const SOLAR: StatItem[] = [
  { icon: Sun, label: "Panels cleaned", to: 86000, suffix: "+" },
  { icon: Zap, label: "Avg. output recovered", to: 22, suffix: "%" },
  { icon: ClipboardCheck, label: "AMC clients", to: 340, suffix: "+" },
  { icon: Star, label: "Client rating", to: 4.9, decimals: 1, suffix: "/5" },
  { icon: MapPin, label: "Cities served", to: 6 },
];

/** Shared trust stats strip — division-aware via ExperienceProvider. */
export function Stats() {
  const { isVehicle } = useExperience();
  const items = isVehicle ? VEHICLE : SOLAR;

  return (
    <section className="border-y border-border bg-white" data-testid="shared-stats">
      <div
        className={`${LANDING_LAYOUT.maxWidth} grid grid-cols-2 divide-border px-5 py-6 md:grid-cols-5 md:divide-x md:px-8`}
      >
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="flex items-center gap-3 px-2 py-2 md:justify-center md:px-4"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--landing-surface-tint)] text-[color:var(--landing-accent)]">
                <Icon className="h-4 w-4" aria-hidden />
              </div>
              <div className="leading-tight">
                <div className="font-display text-xl tracking-tight">
                  <CountUp to={item.to} suffix={item.suffix} decimals={item.decimals ?? 0} />
                </div>
                <div className="text-[11px] text-muted-foreground">{item.label}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
