import { ReactNode } from "react";
import { SkeletonRow } from "./SkeletonRow";
import { EmptyState } from "./EmptyState";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  isLoading?: boolean;
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
}

export function DataTable<T>({
  columns, rows, isLoading, rowKey, onRowClick,
  emptyTitle = "Nothing here yet", emptyDescription, emptyAction,
}: DataTableProps<T>) {
  const cols = columns.length;
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="data-table">
          <thead className="bg-white/[0.03] text-white/60">
            <tr>
              {columns.map(c => (
                <th key={c.key} className={`px-4 py-3 font-medium text-left ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <SkeletonRow cols={cols} rows={6} />
            ) : !rows || rows.length === 0 ? (
              <tr>
                <td colSpan={cols} className="p-0">
                  <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
                </td>
              </tr>
            ) : (
              rows.map(r => (
                <tr
                  key={rowKey(r)}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  className={`border-t border-white/5 ${onRowClick ? "hover:bg-white/[0.03] cursor-pointer" : ""}`}
                  data-testid="data-row"
                >
                  {columns.map(c => (
                    <td key={c.key} className={`px-4 py-3 text-white/80 ${c.className ?? ""} ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""}`}>
                      {c.cell(r)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataTable;
