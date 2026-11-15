import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";

export type ComboboxItem = {
  value: string;
  label: string;
  sublabel?: string;
  disabled?: boolean;
};

export interface SearchableComboboxProps {
  items: ComboboxItem[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  clearable?: boolean;
  allOptionLabel?: string;
  testId?: string;
  id?: string;
  "aria-label"?: string;
}

export function SearchableCombobox({
  items,
  value,
  onValueChange,
  placeholder = "Select an option...",
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  disabled = false,
  className,
  triggerClassName,
  contentClassName,
  clearable = false,
  allOptionLabel,
  testId = "searchable-combobox",
  id,
  "aria-label": ariaLabel,
}: SearchableComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Compile full options list including optional "All" option
  const allItems = React.useMemo(() => {
    const list: ComboboxItem[] = [];
    if (allOptionLabel) {
      list.push({ value: "all", label: allOptionLabel });
    }
    return [...list, ...items];
  }, [allOptionLabel, items]);

  // Filter options dynamically
  const filteredItems = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.sublabel && item.sublabel.toLowerCase().includes(q)) ||
        item.value.toLowerCase().includes(q)
    );
  }, [allItems, searchQuery]);

  // Auto-focus search input when opening
  React.useEffect(() => {
    if (open) {
      setSearchQuery("");
      setHighlightedIndex(0);
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Keep highlighted index in bounds
  React.useEffect(() => {
    if (highlightedIndex >= filteredItems.length) {
      setHighlightedIndex(Math.max(0, filteredItems.length - 1));
    }
  }, [filteredItems, highlightedIndex]);

  const selectedItem = React.useMemo(
    () => allItems.find((item) => String(item.value) === String(value)),
    [allItems, value]
  );

  const handleSelect = (itemValue: string) => {
    onValueChange(itemValue);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange(allOptionLabel ? "all" : "");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredItems.length - 1 ? prev + 1 : prev
      );
      scrollHighlightedIntoView(highlightedIndex + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      scrollHighlightedIntoView(highlightedIndex - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredItems[highlightedIndex] && !filteredItems[highlightedIndex].disabled) {
        handleSelect(filteredItems[highlightedIndex].value);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  const scrollHighlightedIntoView = (index: number) => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll("[data-combobox-item]");
    if (items[index]) {
      items[index].scrollIntoView({ block: "nearest" });
    }
  };

  return (
    <div className={cn("relative inline-block w-full", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={ariaLabel || placeholder}
            disabled={disabled}
            data-testid={testId}
            onKeyDown={handleKeyDown}
            className={cn(
              "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs transition-colors",
              "hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              !selectedItem && "text-muted-foreground",
              disabled && "cursor-not-allowed opacity-50",
              triggerClassName
            )}
          >
            <span className="truncate text-left font-normal text-foreground">
              {selectedItem ? selectedItem.label : placeholder}
            </span>
            <div className="flex items-center gap-1 shrink-0 ml-1">
              {clearable && selectedItem && selectedItem.value !== "all" && !disabled && (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Clear selection"
                  onClick={handleClear}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleClear(e as any);
                    }
                  }}
                  className="rounded-full p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              )}
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          side="bottom"
          avoidCollisions={true}
          collisionPadding={12}
          className={cn(
            "z-[110] w-[var(--radix-popover-trigger-width)] min-w-[220px] p-0 shadow-lg border border-border bg-popover rounded-md overflow-hidden",
            contentClassName
          )}
        >
          {/* Dynamic Search Input */}
          <div className="flex items-center border-b px-2.5 py-1.5 bg-muted/30">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground/70" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setHighlightedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              className="h-8 border-0 bg-transparent text-xs p-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none placeholder:text-muted-foreground/60"
            />
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery("")}
                className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Options List */}
          <div
            ref={listRef}
            className="max-h-60 overflow-y-auto p-1 text-xs"
            role="listbox"
          >
            {filteredItems.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground italic">
                {emptyText}
              </div>
            ) : (
              filteredItems.map((item, index) => {
                const isSelected = String(item.value) === String(value);
                const isHighlighted = index === highlightedIndex;

                return (
                  <div
                    key={item.value}
                    data-combobox-item
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      if (!item.disabled) handleSelect(item.value);
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={cn(
                      "flex items-center justify-between px-2.5 py-2 rounded-sm cursor-pointer select-none transition-colors",
                      isHighlighted ? "bg-accent text-accent-foreground" : "text-foreground",
                      isSelected && "font-medium text-primary",
                      item.disabled && "cursor-not-allowed opacity-50"
                    )}
                  >
                    <div className="flex flex-col truncate pr-2">
                      <span className="truncate">{item.label}</span>
                      {item.sublabel && (
                        <span className="text-[10px] text-muted-foreground truncate">
                          {item.sublabel}
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-primary shrink-0 ml-1" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default SearchableCombobox;
