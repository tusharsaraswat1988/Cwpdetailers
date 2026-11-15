import * as React from "react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ContextualHelp } from "@/components/ui/contextual-help";

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  help?: {
    title?: string;
    content: ReactNode;
    variant?: "tooltip" | "popover";
  } | ReactNode;
}

export function PageHeader({
  title,
  description,
  actions,
  className = "",
  help,
}: PageHeaderProps) {
  const renderedHelp = React.useMemo(() => {
    if (!help) return null;
    if (React.isValidElement(help)) {
      return help;
    }
    if (typeof help === "object" && help !== null && "content" in help) {
      const helpConfig = help as {
        title?: string;
        content: ReactNode;
        variant?: "tooltip" | "popover";
      };
      return (
        <ContextualHelp
          title={helpConfig.title}
          content={helpConfig.content}
          variant={helpConfig.variant || "popover"}
        />
      );
    }
    return help as ReactNode;
  }, [help]);

  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h1
            className="font-display font-bold text-xl sm:text-2xl md:text-3xl text-foreground break-words"
            data-testid="page-title"
          >
            {title}
          </h1>
          {renderedHelp}
        </div>
        {description && (
          <p className="text-muted-foreground text-sm mt-1">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:justify-end shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

export default PageHeader;
