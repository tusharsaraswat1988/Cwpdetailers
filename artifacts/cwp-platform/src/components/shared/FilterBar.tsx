import { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface FilterBarProps {
  search?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  children?: ReactNode;
}

export function FilterBar({ search, onSearchChange, searchPlaceholder = "Search…", children }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-4" data-testid="filter-bar">
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
      {children}
    </div>
  );
}

export default FilterBar;
