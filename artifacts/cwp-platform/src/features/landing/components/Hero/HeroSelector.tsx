import { useId, type KeyboardEvent } from "react";
import { ArrowRight, Car, Sun, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { DIVISION_COLORS, LANDING_MOTION, LANDING_TYPE } from "../../constants";
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
  const surfaceTint =
    option.id === "solar" ? DIVISION_COLORS.solar.surfaceTint : DIVISION_COLORS.vehicle.surfaceTint;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      tabIndex={active ? 0 : -1}
      onClick={onSelect}
      className={cn(
        "group relative flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left",
        "transition-[border-color,background-color,color] duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--landing-ring)] focus-visible:ring-offset-2",
        "sm:min-h-12 sm:gap-3 sm:px-3 sm:py-2.5 md:rounded-2xl",
        active
          ? "border-[color:var(--option-accent)]"
          : "border-border/80 bg-white hover:border-foreground/20 hover:bg-muted/20",
      )}
      style={{
        transitionDuration: `${LANDING_MOTION.selectorTransitionMs}ms`,
        ["--option-accent" as string]: option.accent,
        backgroundColor: active ? surfaceTint : undefined,
      }}
      data-testid={`hero-selector-${option.id}`}
    >
      {active ? (
        <span
          className="absolute right-2 top-1.5 hidden rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider sm:inline-flex"
          style={{
            backgroundColor: `color-mix(in oklch, ${option.accent} 14%, white)`,
            color: option.accent,
          }}
        >
          Selected
        </span>
      ) : null}

      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white sm:h-9 sm:w-9"
        style={{ backgroundColor: option.accent }}
        aria-hidden
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1 pr-4 sm:pr-5">
        <div className="text-[13px] font-semibold uppercase tracking-[0.08em] sm:text-sm">
          {option.title}
        </div>
        <div className="mt-0.5 hidden text-[12px] leading-snug text-muted-foreground 2xl:block">
          {option.description}
        </div>
      </div>

      <ArrowRight
        className={cn(
          "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
          "group-hover:translate-x-0.5",
          !active && "group-hover:text-foreground",
        )}
        style={active ? { color: option.accent } : undefined}
        aria-hidden
      />
    </button>
  );
}

/**
 * In-hero experience switch — compact control, not a standalone section.
 * Persistence, analytics, and URL sync live in ExperienceProvider.
 */
export function HeroSelector({
  content,
  value,
  onChange,
  enterReady,
  className,
}: HeroSelectorProps) {
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
        "rounded-xl border border-border/40 bg-white/50 px-2.5 py-2.5 sm:px-3 sm:py-3",
        className,
      )}
      data-testid="hero-selector"
    >
      <div
        id={titleId}
        className={cn(
          "text-center text-balance font-medium text-foreground/90",
          LANDING_TYPE.selectorTitle,
        )}
      >
        {content.title}
      </div>

      <div
        role="radiogroup"
        aria-labelledby={titleId}
        className="relative mx-auto mt-2 grid grid-cols-2 gap-2 sm:mt-2.5 sm:gap-2.5 md:max-w-3xl"
        onKeyDown={onKeyDown}
      >
        <OptionButton
          option={vehicleOption}
          active={value === vehicleOption.id}
          onSelect={() => onChange(vehicleOption.id, { method: "click" })}
        />
        <OptionButton
          option={solarOption}
          active={value === solarOption.id}
          onSelect={() => onChange(solarOption.id, { method: "click" })}
        />
      </div>
    </div>
  );
}
