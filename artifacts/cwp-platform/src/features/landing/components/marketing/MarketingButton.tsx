import {
  forwardRef,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { LANDING_LAYOUT, LANDING_MOTION } from "../../constants";

export type MarketingButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "accent";
export type MarketingButtonSize = "sm" | "md" | "lg";

type Shared = {
  variant?: MarketingButtonVariant;
  size?: MarketingButtonSize;
  href?: string;
  external?: boolean;
  children: ReactNode;
  className?: string;
};

export type MarketingButtonProps = Shared &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className"> &
  Pick<AnchorHTMLAttributes<HTMLAnchorElement>, "target" | "rel">;

const VARIANT: Record<MarketingButtonVariant, string> = {
  primary: "bg-foreground text-background hover:bg-foreground/90",
  secondary: "bg-white text-foreground border border-border hover:border-foreground/25",
  outline:
    "border border-border bg-transparent text-foreground hover:border-foreground/30 hover:bg-white",
  ghost: "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60",
  accent:
    "bg-[color:var(--landing-accent)] text-white hover:opacity-95 focus-visible:ring-[color:var(--landing-ring)]",
};

const SIZE: Record<MarketingButtonSize, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

export const MarketingButton = forwardRef<HTMLButtonElement, MarketingButtonProps>(
  function MarketingButton(
    {
      variant = "primary",
      size = "md",
      href,
      external,
      className,
      children,
      type = "button",
      onClick,
      ...rest
    },
    ref,
  ) {
    const classes = cn(
      "inline-flex items-center justify-center gap-1.5 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      LANDING_LAYOUT.pillRadius,
      VARIANT[variant],
      SIZE[size],
      className,
    );
    const style = { transitionDuration: `${LANDING_MOTION.selectorTransitionMs}ms` };

    if (href) {
      if (external || href.startsWith("http") || href.startsWith("tel:") || href.startsWith("mailto:")) {
        return (
          <a
            href={href}
            className={classes}
            style={style}
            target={external ? "_blank" : undefined}
            rel={external ? "noreferrer" : undefined}
            onClick={onClick as AnchorHTMLAttributes<HTMLAnchorElement>["onClick"]}
          >
            {children}
          </a>
        );
      }
      return (
        <Link
          href={href}
          className={classes}
          style={style}
          onClick={onClick as AnchorHTMLAttributes<HTMLAnchorElement>["onClick"]}
        >
          {children}
        </Link>
      );
    }

    return (
      <button ref={ref} type={type} className={classes} style={style} onClick={onClick} {...rest}>
        {children}
      </button>
    );
  },
);
