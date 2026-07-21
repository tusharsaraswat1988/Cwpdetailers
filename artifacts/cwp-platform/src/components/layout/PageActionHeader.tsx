import { type ReactNode } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  description?: string;
  primaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
    testId?: string;
  };
  secondaryActions?: ReactNode;
};

/** Page header with a single primary CTA — answers "What should I do next?" */
export function PageActionHeader({ title, description, primaryAction, secondaryActions }: Props) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <div>
        <h1 className="font-display font-bold text-2xl">{title}</h1>
        {description && <p className="text-muted-foreground text-sm mt-0.5">{description}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {secondaryActions}
        {primaryAction && (
          primaryAction.href ? (
            <Link href={primaryAction.href}>
              <Button data-testid={primaryAction.testId ?? "page-primary-cta"}>
                {primaryAction.label}
              </Button>
            </Link>
          ) : (
            <Button
              data-testid={primaryAction.testId ?? "page-primary-cta"}
              onClick={primaryAction.onClick}
            >
              {primaryAction.label}
            </Button>
          )
        )}
      </div>
    </div>
  );
}
