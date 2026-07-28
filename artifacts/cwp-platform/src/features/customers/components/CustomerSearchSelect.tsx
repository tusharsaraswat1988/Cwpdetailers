import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, Phone, Search, UserRound, X } from "lucide-react";
import { searchCustomers, type CustomerSearchRow } from "../api";

export type CustomerSearchValue = Pick<CustomerSearchRow, "id" | "name" | "phone">;

type Props = {
  value: CustomerSearchValue | null;
  onChange: (customer: CustomerSearchValue | null) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  testId?: string;
};

function toValue(row: CustomerSearchRow): CustomerSearchValue {
  return { id: row.id, name: row.name, phone: row.phone };
}

function CustomerResultRow({
  row,
  onPick,
}: {
  row: CustomerSearchRow;
  onPick: () => void;
}) {
  const meta = [row.phone, row.email?.trim(), row.city?.trim()].filter(Boolean);

  return (
    <button
      type="button"
      onMouseDown={e => e.preventDefault()}
      onClick={onPick}
      data-testid={`customer-search-result-${row.id}`}
      className="w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors border-b border-border/60 last:border-b-0 hover:bg-muted/60"
    >
      <UserRound className="h-4 w-4 text-primary mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{row.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {meta.join(" · ")}
        </p>
        {row.branchName && (
          <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 truncate">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden />
            {row.branchName}
          </p>
        )}
      </div>
    </button>
  );
}

/** Inline customer search — type directly, results appear below with details. */
export function CustomerSearchSelect({
  value,
  onChange,
  placeholder = "Search by name or phone…",
  disabled,
  id,
  testId = "customer-search-select",
}: Props) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<CustomerSearchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (query.trim().length < 2) {
        setOptions([]);
        return;
      }
      setLoading(true);
      try {
        setOptions(await searchCustomers(query.trim()));
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const showResults = focused && !value;
  const showPanel = showResults && (query.trim().length >= 2 || loading);

  if (value) {
    return (
      <div
        className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 flex items-start justify-between gap-3"
        data-testid={`${testId}-selected`}
      >
        <div className="flex items-start gap-2 min-w-0">
          <UserRound className="h-4 w-4 text-primary mt-0.5 shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{value.name}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Phone className="h-3 w-3 shrink-0" aria-hidden />
              {value.phone}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 px-2"
          onClick={() => {
            onChange(null);
            setQuery("");
          }}
          data-testid={`${testId}-clear`}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Change customer</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-0" data-testid={testId}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden />
        <Input
          id={id}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 150)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className="pl-9"
          data-testid={`${testId}-input`}
        />
      </div>

      {showResults && query.trim().length < 2 && !loading && (
        <p className="text-xs text-muted-foreground px-1 pt-2">
          Type at least 2 characters — name, phone, or email.
        </p>
      )}

      {showPanel && (
        <div
          className="mt-2 rounded-lg border border-border bg-card shadow-sm overflow-hidden"
          data-testid={`${testId}-results`}
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Searching…
            </div>
          ) : options.length === 0 ? (
            <p className="px-3 py-6 text-sm text-muted-foreground text-center">
              No customers found for &ldquo;{query.trim()}&rdquo;
            </p>
          ) : (
            <div className="max-h-[280px] overflow-y-auto">
              {options.map(opt => (
                <CustomerResultRow
                  key={opt.id}
                  row={opt}
                  onPick={() => {
                    onChange(toValue(opt));
                    setQuery("");
                    setFocused(false);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
