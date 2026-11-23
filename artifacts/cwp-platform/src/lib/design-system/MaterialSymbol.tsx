import React from "react";
import { cn } from "@/lib/utils";
import { M3_ICON_SPECS } from "./tokens";

export type MaterialSymbolSize = "xs" | "sm" | "base" | "md" | "lg" | "xl" | number;

export interface MaterialSymbolProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Name of the Material Symbol (snake_case, e.g. "directions_car", "check_circle") */
  name: string;
  /** Optical size: xs=16, sm=18, base=20, md=24 (default), lg=32, xl=48 or exact pixel number */
  size?: MaterialSymbolSize;
  /** Font stroke weight: 300, 400 (regular, default), 500 (medium), 600 */
  weight?: 300 | 400 | 500 | 600 | 700;
  /** Fill state: true for solid fill, false for outline (default) */
  fill?: boolean;
  /** Grade: -25, 0 (default), 200 */
  grade?: -25 | 0 | 200;
  /** Accessible label. If provided, role="img" and aria-label are set; otherwise aria-hidden="true". */
  label?: string;
  className?: string;
}

/**
 * Official Material Design 3 Symbol Component
 * Compliant with M3 Icon Guidelines: https://m3.material.io/styles/icons/overview
 */
export const MaterialSymbol = React.forwardRef<HTMLSpanElement, MaterialSymbolProps>(
  (
    {
      name,
      size = "md",
      weight = 400,
      fill = false,
      grade = 0,
      label,
      className,
      style,
      ...props
    },
    ref
  ) => {
    const pixelSize =
      typeof size === "number"
        ? size
        : M3_ICON_SPECS.size[size] ?? M3_ICON_SPECS.size.md;

    // Font variation settings for Google Material Symbols
    const fontVariationSettings = `'FILL' ${fill ? 1 : 0}, 'wght' ${weight}, 'GRAD' ${grade}, 'opsz' ${pixelSize}`;

    return (
      <span
        ref={ref}
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={!label ? true : undefined}
        className={cn(
          "material-symbols-outlined select-none inline-flex items-center justify-center shrink-0 align-middle leading-none",
          className
        )}
        style={{
          fontSize: `${pixelSize}px`,
          width: `${pixelSize}px`,
          height: `${pixelSize}px`,
          fontVariationSettings,
          ...style,
        }}
        data-m3-symbol={name}
        {...props}
      >
        {name}
      </span>
    );
  }
);

MaterialSymbol.displayName = "MaterialSymbol";
