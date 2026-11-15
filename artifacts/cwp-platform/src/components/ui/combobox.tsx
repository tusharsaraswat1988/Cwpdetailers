import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export interface ComboboxOption {
  value: string;
  label: string;
  subLabel?: string;
  keywords?: string[];
  disabled?: boolean;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  id?: string;
  testId?: string;
  modal?: boolean;
}

export function Combobox({
  options = [],
  value,
  onChange,
  placeholder = "Select option...",
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  disabled = false,
  clearable = false,
  className,
  triggerClassName,
  contentClassName,
  id,
  testId,
  modal = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selectedOption = React.useMemo(() => {
    return options.find((opt) => opt.value === value);
  }, [options, value]);

  // Case-insensitive in-memory substring filtering on label, subLabel, and keywords
  const filteredOptions = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return options;
    return options.filter((opt) => {
      if (opt.label.toLowerCase().includes(term)) return true;
      if (opt.subLabel && opt.subLabel.toLowerCase().includes(term)) return true;
      if (opt.keywords && opt.keywords.some((k) => k.toLowerCase().includes(term))) return true;
      return false;
    });
  }, [options, search]);

  // Reset search input whenever the popover closes
  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSearch("");
    }
  }, []);

  const handleClear = React.useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      e.preventDefault();
      onChange("");
    },
    [onChange]
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal={modal}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          disabled={disabled}
          data-testid={testId || "combobox-trigger"}
          className={cn(
            "w-full justify-between font-normal text-left h-10 px-3",
            !selectedOption && "text-muted-foreground",
            triggerClassName,
            className
          )}
        >
          <span className="truncate flex-1 mr-2 text-foreground">
            {selectedOption ? (
              <span>
                {selectedOption.label}
                {selectedOption.subLabel && (
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    ({selectedOption.subLabel})
                  </span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {clearable && Boolean(value) && !disabled && (
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear selection"
                data-testid="combobox-clear"
                className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
                onClick={handleClear}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    handleClear(e);
                  }
                }}
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={8}
        avoidCollisions={true}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
        className={cn(
          "w-[var(--radix-popover-trigger-width)] min-w-[200px] p-0 z-[110] max-h-[300px] overflow-hidden shadow-lg",
          contentClassName
        )}
      >
        <Command shouldFilter={false} className="w-full">
          <CommandInput
            ref={inputRef}
            value={search}
            onValueChange={setSearch}
            placeholder={searchPlaceholder}
            className="h-9"
          />
          <CommandList className="max-h-[250px] overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <CommandEmpty>{emptyText}</CommandEmpty>
            ) : (
              <CommandGroup>
                {filteredOptions.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <CommandItem
                      key={opt.value}
                      value={opt.value || opt.label}
                      disabled={opt.disabled}
                      onSelect={() => {
                        onChange(opt.value);
                        setOpen(false);
                        setSearch("");
                      }}
                      className="flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Check
                          className={cn(
                            "h-4 w-4 shrink-0 text-primary transition-opacity",
                            isSelected ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="truncate text-sm">{opt.label}</span>
                          {opt.subLabel && (
                            <span className="text-xs text-muted-foreground truncate">
                              {opt.subLabel}
                            </span>
                          )}
                        </div>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default Combobox;
