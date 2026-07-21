import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useInView } from "./useInView";

type RevealProps = {
  children: ReactNode;
  className?: string;
  stagger?: boolean;
  delay?: number;
};

/**
 * Subtle scroll reveal. Uses scoped `.cwp-reveal` classes from landing.css.
 * Disabled visually when prefers-reduced-motion is set (CSS).
 */
export function Reveal({
  children,
  className,
  stagger = false,
  delay = 0,
}: RevealProps) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const style: CSSProperties | undefined = delay
    ? { transitionDelay: `${delay}ms` }
    : undefined;

  return (
    <div
      ref={ref}
      style={style}
      className={cn("cwp-reveal", stagger && "cwp-stagger", inView && "is-in", className)}
    >
      {children}
    </div>
  );
}
