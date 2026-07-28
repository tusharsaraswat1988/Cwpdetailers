import { cn } from "@/lib/utils";
import {
  formatAddressLines,
  type ServiceAddressParts,
} from "@/features/customers/lib/serviceAddress";

type Props = {
  /** Structured parts, composed multiline string, or null. */
  value: ServiceAddressParts | string | null | undefined;
  /** Optional site label shown above address lines, e.g. Home · Varanasi */
  siteLabel?: string | null;
  city?: string | null;
  className?: string;
  /** line-clamp for compact rows */
  compact?: boolean;
  testId?: string;
};

/** Master CWP address display — same layout in admin, customer app, and staff. */
export function FormattedAddressDisplay({
  value,
  siteLabel,
  city,
  className,
  compact,
  testId = "formatted-address",
}: Props) {
  const lines = formatAddressLines(
    typeof value === "string" || value == null
      ? value
      : { ...value, city: value.city || city || "" },
  );

  if (lines.length === 0) return null;

  const header = [siteLabel?.trim(), city?.trim()].filter(Boolean).join(" · ");

  return (
    <div className={cn("min-w-0", className)} data-testid={testId}>
      {header ? (
        <p className={cn("font-medium", compact ? "text-xs" : "text-sm")}>{header}</p>
      ) : null}
      <div className={cn(header ? "mt-0.5" : "", compact ? "text-xs text-muted-foreground" : "text-sm text-muted-foreground")}>
        {lines.map((line, i) => (
          <p
            key={i}
            className={cn("leading-snug", compact && i === 0 ? "line-clamp-2" : compact ? "line-clamp-1" : "")}
          >
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
