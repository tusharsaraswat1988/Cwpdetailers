import { ReactNode } from "react";
import { Search, CalendarIcon, X, BookmarkCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

export type FilterOption = { value: string; label: string };
export type QuickFilter = { id: string; label: string; active: boolean; onClick: () => void };
export type SavedFilter = { id: string; label: string };

interface FilterBarProps {
  search?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  /** Single-select status/category dropdown — pass options + value + onChange. */
  statusOptions?: FilterOption[];
  statusValue?: string;
  onStatusChange?: (value: string) => void;
  statusPlaceholder?: string;
  /** Date range picker — omit to hide. */
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange | undefined) => void;
  /** Toggle chips for one-click common filters (e.g. "Overdue", "This week"). */
  quickFilters?: QuickFilter[];
  /** Future-ready: named filter presets a user could save/apply. UI-only for now. */
  savedFilters?: SavedFilter[];
  onSavedFilterSelect?: (id: string) => void;
  /** Extra custom filter controls (Selects, etc.) rendered after the built-ins. */
  children?: ReactNode;
  /** Shows a "Clear filters" button when any filter is active. */
  onClearAll?: () => void;
  className?: string;
}

/**
 * The one filter toolbar for the admin panel: search, status, date range,
 * quick-filter chips, saved filters (future-ready) and a custom slot for
 * anything module-specific. Extend via props rather than building a
 * page-specific filter card. See docs/UI_CONSTITUTION.md.
 */
export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  statusOptions,
  statusValue,
  onStatusChange,
  statusPlaceholder = "Status",
  dateRange,
  onDateRangeChange,
  quickFilters,
  savedFilters,
  onSavedFilterSelect,
  children,
  onClearAll,
  className,
}: FilterBarProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)} data-testid="filter-bar">
      <div className="flex flex-wrap items-center gap-3">
        {onSearchChange && (
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search ?? ""}
              onChange={e => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9"
              data-testid="filter-search"
            />
          </div>
        )}

        {statusOptions && onStatusChange && (
          <Select value={statusValue} onValueChange={onStatusChange}>
            <SelectTrigger className="w-[150px]" data-testid="filter-status">
              <SelectValue placeholder={statusPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {onDateRangeChange && (
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="gap-2" data-testid="filter-date-range">
                <CalendarIcon size={14} />
                {dateRange?.from
                  ? dateRange.to
                    ? `${dateRange.from.toLocaleDateString()} – ${dateRange.to.toLocaleDateString()}`
                    : dateRange.from.toLocaleDateString()
                  : "Date range"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="range" selected={dateRange} onSelect={onDateRangeChange} numberOfMonths={2} />
            </PopoverContent>
          </Popover>
        )}

        {savedFilters && savedFilters.length > 0 && onSavedFilterSelect && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="gap-2" data-testid="filter-saved">
                <BookmarkCheck size={14} />
                Saved filters
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {savedFilters.map(f => (
                <DropdownMenuItem key={f.id} onClick={() => onSavedFilterSelect(f.id)}>
                  {f.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {children}

        {onClearAll && (
          <Button type="button" variant="ghost" size="sm" onClick={onClearAll} className="gap-1 text-muted-foreground">
            <X size={14} />
            Clear
          </Button>
        )}
      </div>

      {quickFilters && quickFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {quickFilters.map(qf => (
            <button
              key={qf.id}
              type="button"
              onClick={qf.onClick}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                qf.active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent text-muted-foreground border-border hover:bg-muted",
              )}
              aria-pressed={qf.active}
              data-testid={`quick-filter-${qf.id}`}
            >
              {qf.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default FilterBar;
