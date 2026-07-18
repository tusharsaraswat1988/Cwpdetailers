import { ReactNode, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsUpDown, ChevronUp, ChevronDown, Columns3 } from "lucide-react";
import { SkeletonRow } from "./SkeletonRow";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  /** Enables the sort toggle in the header for this column. */
  sortable?: boolean;
  /** Column can be hidden via the column-visibility menu. Defaults to true. */
  hideable?: boolean;
  /** Hidden by default (still toggleable). */
  defaultHidden?: boolean;
  /** Keeps this column pinned to the right edge on horizontal scroll — use for a row-actions column. */
  sticky?: "right";
}

export interface DataTablePagination {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export type SortDirection = "asc" | "desc";

export interface DataTableSort {
  key: string;
  direction: SortDirection;
  onSortChange: (key: string, direction: SortDirection) => void;
}

export interface DataTableSelection<T> {
  selectedKeys: Array<string | number>;
  onSelectionChange: (keys: Array<string | number>) => void;
  getRowKey?: (row: T) => string | number;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  isLoading?: boolean;
  /** When set, renders the shared ErrorState instead of rows/empty state. */
  error?: unknown;
  onRetry?: () => void;
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  rowLabel?: (row: T) => string;
  caption?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  /** Enables the standard footer pager. Omit for pages that load everything at once. */
  pagination?: DataTablePagination;
  /** Controlled sort state — omit for tables that don't support sorting. */
  sort?: DataTableSort;
  /** Adds a checkbox column and enables bulk selection. Pair with BulkActionBar. */
  selection?: DataTableSelection<T>;
  /** Shows the column-visibility dropdown in the toolbar row above the table. */
  enableColumnVisibility?: boolean;
  /** Rendered above the table — typically a FilterBar (search + filter slot). */
  toolbar?: ReactNode;
  /** Keeps the header row visible while the table body scrolls. Default true. */
  stickyHeader?: boolean;
  className?: string;
}

/**
 * The one table implementation for the admin panel. Do not hand-roll a new
 * <table> in feature code — extend this component instead so every list page
 * shares loading/empty/error states, sorting, selection, column visibility
 * and pagination behavior. See docs/UI_CONSTITUTION.md.
 */
export function DataTable<T>({
  columns, rows, isLoading, error, onRetry, rowKey, onRowClick, rowLabel, caption,
  emptyTitle = "Nothing here yet", emptyDescription, emptyAction, pagination,
  sort, selection, enableColumnVisibility, toolbar, stickyHeader = true, className,
}: DataTableProps<T>) {
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(
    () => new Set(columns.filter(c => c.defaultHidden).map(c => c.key)),
  );

  const visibleColumns = useMemo(
    () => columns.filter(c => !hiddenKeys.has(c.key)),
    [columns, hiddenKeys],
  );

  const showError = !!error && !isLoading;
  const hasSelection = !!selection;
  const cols = visibleColumns.length + (hasSelection ? 1 : 0);

  const getKey = (row: T) => (selection?.getRowKey ?? rowKey)(row);
  const allKeys = rows?.map(getKey) ?? [];
  const selectedSet = new Set(selection?.selectedKeys ?? []);
  const allSelected = allKeys.length > 0 && allKeys.every(k => selectedSet.has(k));
  const someSelected = !allSelected && allKeys.some(k => selectedSet.has(k));

  const toggleAll = () => {
    if (!selection) return;
    selection.onSelectionChange(allSelected ? [] : allKeys);
  };

  const toggleRow = (key: string | number) => {
    if (!selection) return;
    const next = new Set(selectedSet);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    selection.onSelectionChange(Array.from(next));
  };

  const headerCellClass = (c: Column<T>) =>
    cn(
      "px-4 py-3 font-medium text-left",
      c.align === "right" && "text-right",
      c.align === "center" && "text-center",
      c.sticky === "right" && "sticky right-0 bg-muted shadow-[inset_1px_0_0_hsl(var(--border))]",
    );

  const bodyCellClass = (c: Column<T>) =>
    cn(
      "px-4 py-3 text-foreground",
      c.className,
      c.align === "right" && "text-right",
      c.align === "center" && "text-center",
      c.sticky === "right" && "sticky right-0 bg-card shadow-[inset_1px_0_0_hsl(var(--border))]",
    );

  return (
    <div className={cn("rounded-xl border border-border bg-card overflow-hidden", className)}>
      {(toolbar || enableColumnVisibility) && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-3">
          <div className="flex-1 min-w-0">{toolbar}</div>
          {enableColumnVisibility && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" data-testid="column-visibility-trigger">
                  <Columns3 size={14} />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {columns.filter(c => c.hideable !== false).map(c => (
                  <DropdownMenuCheckboxItem
                    key={c.key}
                    checked={!hiddenKeys.has(c.key)}
                    onCheckedChange={(checked) => {
                      setHiddenKeys(prev => {
                        const next = new Set(prev);
                        if (checked) next.delete(c.key);
                        else next.add(c.key);
                        return next;
                      });
                    }}
                  >
                    {typeof c.header === "string" ? c.header : c.key}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="data-table">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className={cn("bg-muted text-muted-foreground", stickyHeader && "sticky top-0 z-10")}>
            <tr>
              {hasSelection && (
                <th scope="col" className="w-10 px-4 py-3">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={toggleAll}
                    aria-label="Select all rows"
                    data-testid="select-all-checkbox"
                  />
                </th>
              )}
              {visibleColumns.map(c => (
                <th key={c.key} scope="col" className={headerCellClass(c)}>
                  {c.sortable && sort ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                      onClick={() => sort.onSortChange(c.key, sort.key === c.key && sort.direction === "asc" ? "desc" : "asc")}
                      data-testid={`sort-${c.key}`}
                    >
                      {c.header}
                      {sort.key === c.key ? (
                        sort.direction === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />
                      ) : (
                        <ChevronsUpDown size={13} className="opacity-50" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {showError ? (
              <tr>
                <td colSpan={cols} className="p-0">
                  <ErrorState onRetry={onRetry} />
                </td>
              </tr>
            ) : isLoading ? (
              <SkeletonRow cols={cols} rows={6} />
            ) : !rows || rows.length === 0 ? (
              <tr>
                <td colSpan={cols} className="p-0">
                  <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
                </td>
              </tr>
            ) : (
              rows.map(r => {
                const key = getKey(r);
                const isSelected = selectedSet.has(key);
                return (
                  <tr
                    key={rowKey(r)}
                    onClick={onRowClick ? () => onRowClick(r) : undefined}
                    onKeyDown={onRowClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onRowClick(r); } } : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    role={onRowClick ? "button" : undefined}
                    aria-label={onRowClick && rowLabel ? rowLabel(r) : undefined}
                    aria-selected={hasSelection ? isSelected : undefined}
                    className={cn(
                      "border-t border-border",
                      onRowClick && "hover:bg-muted/50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
                      isSelected && "bg-primary/5",
                    )}
                    data-testid="data-row"
                  >
                    {hasSelection && (
                      <td className="w-10 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleRow(key)}
                          aria-label={rowLabel ? `Select ${rowLabel(r)}` : "Select row"}
                          data-testid="select-row-checkbox"
                        />
                      </td>
                    )}
                    {visibleColumns.map(c => (
                      <td key={c.key} className={bodyCellClass(c)}>
                        {c.cell(r)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {pagination && !showError && (rows?.length ?? 0) > 0 && (
        <TablePagination {...pagination} />
      )}
    </div>
  );
}

function TablePagination({ page, pageSize, total, onPageChange }: DataTablePagination) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground"
      role="navigation"
      aria-label="Table pagination"
      data-testid="data-table-pagination"
    >
      <span>
        Showing <span className="font-medium text-foreground">{from}</span>–<span className="font-medium text-foreground">{to}</span> of{" "}
        <span className="font-medium text-foreground">{total}</span>
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
          Previous
        </Button>
        <span className="tabular-nums px-1">
          Page {page} of {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          Next
          <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
}

export default DataTable;
