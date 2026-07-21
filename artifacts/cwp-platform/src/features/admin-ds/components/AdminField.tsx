import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function AdminField({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("admin-field", className)} data-testid="admin-field">
      <Label htmlFor={htmlFor} className="admin-field-label">
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>
      {children}
      {error ? (
        <p className="admin-field-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="admin-field-hint">{hint}</p>
      ) : null}
    </div>
  );
}
