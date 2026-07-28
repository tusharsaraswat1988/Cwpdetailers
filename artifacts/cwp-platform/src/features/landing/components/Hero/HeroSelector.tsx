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
        "group relative flex w-full items-center gap-4 rounded-2xl border p-5 text-left transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--landing-ring)] focus-visible:ring-offset-2",
        "lg:min-h-[7.5rem] lg:gap-5 lg:p-6",
        active
          ? cn(
              "border-[color:var(--landing-accent)]/25 bg-[color:var(--landing-surface-tint)] ring-2 ring-[color:var(--landing-accent)]/12",
              HERO_SHADOW.optionActive,
            )
          : "border-border/80 bg-white hover:border-foreground/20 hover:bg-muted/20",
      )}
      style={{ transitionDuration: `${LANDING_MOTION.selectorTransitionMs}ms` }}
      data-testid={`hero-selector-${option.id}`}
    >
      {active ? (
        <span className="absolute right-4 top-4 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
          Selected
        </span>
      ) : null}

      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-sm lg:h-14 lg:w-14"
        style={{ backgroundColor: option.accent }}
        aria-hidden
      >
        <Icon className="h-5 w-5 lg:h-6 lg:w-6" />
      </div>

      <div className="min-w-0 flex-1 pr-2 lg:pr-4">
        <div className="font-semibold text-base lg:text-lg">{option.title}</div>
        <div className="mt-1.5 text-sm leading-relaxed text-muted-foreground lg:text-[15px]">
          {option.description}
        </div>
      </div>

      <ArrowRight
        className={cn(
          "h-5 w-5 shrink-0 text-muted-foreground transition",
          "group-hover:translate-x-0.5 group-hover:text-foreground",
          active && "text-[color:var(--landing-accent)]",
        )}
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
        "border border-border/70 bg-white/95 p-6 backdrop-blur-sm md:p-8 lg:p-10",
        HERO_SHADOW.selector,
        LANDING_LAYOUT.sectionRadius,
        className,
      )}
      data-testid="hero-selector"
    >
      <div className="mx-auto max-w-3xl text-center lg:max-w-4xl">
        <div
          id={labelId}
          className={cn(
            "font-medium uppercase tracking-[0.14em] text-muted-foreground",
            LANDING_TYPE.selectorLabel,
          )}
        >
          {content.label}
        </div>
        <div
          id={titleId}
          className={cn(
            "mt-2.5 text-balance font-display",
            LANDING_TYPE.selectorTitle,
          )}
        >
          {content.title}
        </div>
      </div>

      <div
        role="radiogroup"
        aria-labelledby={`${labelId} ${titleId}`}
        className="relative mx-auto mt-8 grid max-w-5xl gap-4 lg:mt-10 lg:grid-cols-2 lg:gap-x-10"
        onKeyDown={onKeyDown}
      >
        <OptionButton
          option={vehicleOption}
          active={value === vehicleOption.id}
          onSelect={() => onChange(vehicleOption.id, { method: "click" })}
        />

        <div className="flex items-center justify-center py-0.5 lg:hidden" aria-hidden>
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {content.orLabel}
          </span>
        </div>

        <OptionButton
          option={solarOption}
          active={value === solarOption.id}
          onSelect={() => onChange(solarOption.id, { method: "click" })}
        />

        <div
          className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 lg:block"
          aria-hidden
        >
          <span className="rounded-full border border-border bg-white px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground shadow-sm">
            {content.orLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
