import {
  BadgeCheck,
  Camera,
  Droplets,
  Shield,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LANDING_TYPE } from "../../constants";
import type { HeroTrustPill } from "../../content/heroTypes";
import { heroEnter } from "../../lib/heroEnter";

export type HeroTrustBarProps = {
  pills: HeroTrustPill[];
  enterReady: boolean;
  className?: string;
};

const ICONS: Record<NonNullable<HeroTrustPill["icon"]>, LucideIcon> = {
  shield: Shield,
  droplets: Droplets,
  camera: Camera,
  zap: Zap,
  badgeCheck: BadgeCheck,
};

export function HeroTrustBar({ pills, enterReady, className }: HeroTrustBarProps) {
  const enter = heroEnter("trust", enterReady);
  if (!pills.length) return null;

  return (
    <ul
      style={enter.style}
      className={cn(
        enter.className,
        "mt-6 flex list-none flex-wrap items-center gap-2.5 p-0 text-muted-foreground",
        LANDING_TYPE.trust,
        className,
      )}
      aria-label="Trust highlights"
    >
      {pills.map((pill) => {
        const Icon = pill.icon ? ICONS[pill.icon] : null;
        return (
          <li
            key={pill.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 font-medium"
          >
            {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
            {pill.label}
          </li>
        );
      })}
    </ul>
  );
}
