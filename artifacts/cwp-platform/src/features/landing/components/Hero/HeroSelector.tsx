import { useId, type KeyboardEvent } from "react";
import { ArrowRight, Car, Sun, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { HERO_SHADOW, LANDING_LAYOUT, LANDING_MOTION, LANDING_TYPE } from "../../constants";
import type { HeroSelectorContent, HeroSelectorOption } from "../../content/heroTypes";
import { heroEnter } from "../../lib/heroEnter";
import type { Division } from "../../types";

export type HeroSelectorProps = {
  content: HeroSelectorContent;
  /** Controlled — state owned by ExperienceProvider */
  value: Division;
  onChange: (division: Division, meta?: { method: "click" | "keyboard"; key?: string }) => void;
  enterReady: boolean;
  className?: string;
};

const OPTION_ICONS: Record<"car" | "sun", LucideIcon> = {
  car: Car,
  sun: Sun,
};

type OptionButtonProps = {
  option: HeroSelectorOption;
  active: boolean;
  onSelect: () => void;
};

function OptionButton({ option, active, onSelect }: OptionButtonProps) {
  const Icon = OPTION_ICONS[option.icon];
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      tabIndex={active ? 0 : -1}
      onClick={onSelect}
      className={cn(
        "group relative flex items-center gap-4 rounded-2xl border p-4 text-left md:p-5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--landing-ring)] focus-visible:ring-offset-2",
        active
          ? cn(
              "border-transparent bg-[color:var(--landing-surface-tint)] ring-2 ring-foreground/8",
              HERO_SHADOW.optionActive,
            )
          : "border-border bg-white hover:border-foreground/20",
      )}
      style={{ transitionDuration: `${LANDING_MOTION.selectorTransitionMs}ms` }}
      data-testid={`hero-selector-${option.id}`}
    >
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
        style={{ backgroundColor: option.accent }}
        aria-hidden
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 font-semibold">
          {option.title}
          {active ? (
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
              Selected
            </span>
          ) : null}
        </div>
        <div className="mt-1 text-[13px] leading-snug text-muted-foreground">
          {option.description}
        </div>
      </div>
      <ArrowRight
        className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground"
        aria-hidden
      />
    </button>
  );
}

/**
 * Presentation-only vehicle/solar selector.
 * Persistence, analytics, and URL sync live in ExperienceProvider.
 */
export function HeroSelector({
  content,
  value,
  onChange,
  enterReady,
  className,
}: HeroSelectorProps) {
  const labelId = useId();
  const titleId = useId();
  const enter = heroEnter("selector", enterReady);
  const [vehicleOption, solarOption] = content.options;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const order = content.options.map((o) => o.id);
    const idx = order.indexOf(value);
    const emit = (next: Division, key: string) => {
      event.preventDefault();
      onChange(next, { method: "keyboard", key });
    };
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      emit(order[(idx + 1) % order.length], event.key);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      emit(order[(idx - 1 + order.length) % order.length], event.key);
    } else if (event.key === "Home") {
      emit(order[0], event.key);
    } else if (event.key === "End") {
      emit(order[order.length - 1], event.key);
    }
  };

  return (
    <div
      style={enter.style}
      className={cn(
        enter.className,
        "mt-10 border border-border bg-white p-6 md:p-7",
        HERO_SHADOW.selector,
        LANDING_LAYOUT.sectionRadius,
        className,
      )}
      data-testid="hero-selector"
    >
      <div className="text-center">
        <div
          id={labelId}
          className={cn(
            "font-medium uppercase tracking-[0.14em] text-muted-foreground",
            LANDING_TYPE.selectorLabel,
          )}
        >
          {content.label}
        </div>
        <div id={titleId} className={cn("mt-2 font-display", LANDING_TYPE.selectorTitle)}>
          {content.title}
        </div>
      </div>

      <div
        role="radiogroup"
        aria-labelledby={`${labelId} ${titleId}`}
        className="mt-6 grid gap-3 md:grid-cols-[1fr_auto_1fr]"
        onKeyDown={onKeyDown}
      >
        <OptionButton
          option={vehicleOption}
          active={value === vehicleOption.id}
          onSelect={() => onChange(vehicleOption.id, { method: "click" })}
        />
        <div
          className="hidden items-center justify-center text-xs font-medium text-muted-foreground md:flex"
          aria-hidden
        >
          {content.orLabel}
        </div>
        <OptionButton
          option={solarOption}
          active={value === solarOption.id}
          onSelect={() => onChange(solarOption.id, { method: "click" })}
        />
      </div>
    </div>
  );
}
