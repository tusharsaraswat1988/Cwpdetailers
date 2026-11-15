import * as React from "react";
import { Info, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface ContextualHelpProps {
  title?: string;
  content: React.ReactNode;
  variant?: "tooltip" | "popover";
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  icon?: "info" | "help";
  className?: string;
  triggerClassName?: string;
}

export function ContextualHelp({
  title,
  content,
  variant = "tooltip",
  side = "top",
  align = "center",
  icon = "info",
  className,
  triggerClassName,
}: ContextualHelpProps) {
  const IconComponent = icon === "help" ? HelpCircle : Info;
  const accessibleLabel = title || "Contextual information";

  const triggerButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={accessibleLabel}
      data-testid="contextual-help-trigger"
      className={cn(
        "h-6 w-6 rounded-full text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 transition-colors shrink-0 inline-flex items-center justify-center p-0",
        triggerClassName
      )}
    >
      <IconComponent className="h-3.5 w-3.5" />
    </Button>
  );

  if (variant === "popover") {
    return (
      <Popover>
        <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
        <PopoverContent
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={8}
          avoidCollisions={true}
          className={cn(
            "w-72 max-w-[calc(100vw-2rem)] z-[110] p-3 text-popover-foreground shadow-md rounded-lg border border-border bg-popover",
            className
          )}
        >
          {title && (
            <div className="flex items-center justify-between pb-1.5 border-b border-border mb-2">
              <h4 className="font-semibold text-sm text-foreground">{title}</h4>
            </div>
          )}
          <div className="text-xs text-muted-foreground leading-relaxed">
            {content}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{triggerButton}</TooltipTrigger>
        <TooltipContent
          side={side}
          align={align}
          sideOffset={4}
          className={cn(
            "max-w-xs z-[110] p-2.5 bg-popover text-popover-foreground border border-border shadow-md rounded-md",
            className
          )}
        >
          {title && (
            <div className="font-semibold text-xs text-foreground mb-1">
              {title}
            </div>
          )}
          <div className="text-xs text-muted-foreground leading-normal">
            {content}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default ContextualHelp;
