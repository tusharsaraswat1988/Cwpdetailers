import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Info, HelpCircle, Lightbulb, ExternalLink } from "lucide-react";

export interface ContextHelpProps {
  title?: string;
  description: React.ReactNode;
  guidance?: string;
  technicalDetails?: Array<{ label: string; value: string }>;
  link?: { href: string; label: string };
  variant?: "popover" | "tooltip";
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  size?: "xs" | "sm" | "md";
  className?: string;
  ariaLabel?: string;
}

export function ContextHelp({
  title,
  description,
  guidance,
  technicalDetails,
  link,
  variant = "popover",
  side = "top",
  align = "center",
  size = "sm",
  className,
  ariaLabel,
}: ContextHelpProps) {
  const iconSize = size === "xs" ? 11 : size === "md" ? 16 : 13;
  const buttonDimensions = size === "xs" ? "h-4 w-4" : size === "md" ? "h-6 w-6" : "h-5 w-5";

  // If simple tooltip variant requested with no complex guidance or technical details:
  if (variant === "tooltip" && !guidance && !technicalDetails && !link) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={ariaLabel || title || "Information"}
              className={cn(
                "inline-flex items-center justify-center rounded-full text-muted-foreground/70 hover:text-primary hover:bg-primary/10 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 shrink-0 ml-1 cursor-help",
                buttonDimensions,
                className
              )}
            >
              <Info size={iconSize} />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side={side}
            align={align}
            className="max-w-xs text-xs font-normal p-2.5 z-[120] bg-popover text-popover-foreground border shadow-md leading-relaxed"
          >
            {title && <p className="font-semibold mb-1 text-foreground">{title}</p>}
            <div>{description}</div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Rich popover variant (default)
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel || title || "Contextual help and documentation"}
          className={cn(
            "inline-flex items-center justify-center rounded-full text-muted-foreground/70 hover:text-primary hover:bg-primary/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 shrink-0 ml-1 cursor-pointer",
            buttonDimensions,
            className
          )}
        >
          <Info size={iconSize} />
        </button>
      </PopoverTrigger>

      <PopoverContent
        side={side}
        align={align}
        sideOffset={6}
        collisionPadding={12}
        avoidCollisions={true}
        className="w-80 sm:w-96 p-4 z-[120] shadow-xl border border-border bg-popover text-popover-foreground rounded-xl space-y-3"
      >
        {/* Title Header */}
        <div className="flex items-center gap-2 border-b pb-2">
          <div className="p-1 rounded-md bg-primary/10 text-primary shrink-0">
            <HelpCircle size={15} />
          </div>
          <h4 className="text-xs font-bold text-foreground leading-tight">
            {title || "System Information & Guidance"}
          </h4>
        </div>

        {/* Primary Description */}
        <div className="text-xs text-muted-foreground leading-relaxed">
          {description}
        </div>

        {/* Operational Guidance Callout */}
        {guidance && (
          <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 space-y-1">
            <div className="flex items-center gap-1.5 text-primary text-[11px] font-semibold">
              <Lightbulb size={13} />
              <span>Operational Guidance</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              {guidance}
            </p>
          </div>
        )}

        {/* Technical & Schema Details */}
        {technicalDetails && technicalDetails.length > 0 && (
          <div className="space-y-1.5 pt-1 border-t">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              System Rules & Telemetry
            </span>
            <div className="rounded-md border bg-muted/40 divide-y divide-border/60 text-[11px]">
              {technicalDetails.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center py-1 px-2.5">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-mono text-foreground font-medium text-[10px]">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Optional External Documentation Link */}
        {link && (
          <div className="pt-1 text-right">
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-[11px] text-primary hover:underline font-medium"
            >
              <span>{link.label}</span>
              <ExternalLink size={11} className="ml-1" />
            </a>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default ContextHelp;
