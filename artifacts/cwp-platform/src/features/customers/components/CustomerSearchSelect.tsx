import { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import { searchCustomers } from "../api";

export type CustomerSearchValue = {
  id: number;
  name: string;
  phone: string;
};

type Props = {
  value: CustomerSearchValue | null;
  onChange: (customer: CustomerSearchValue | null) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  testId?: string;
};

function toLabel(c: CustomerSearchValue) {
  return `${c.name} · ${c.phone}`;
}

export function CustomerSearchSelect({
  value,
  onChange,
  placeholder = "Search by name or phone…",
  disabled,
  id,
  testId = "customer-search-select",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<CustomerSearchValue[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      if (query.trim().length < 2) {
        setOptions([]);
        return;
      }
      setLoading(true);
      try {
        const rows = await searchCustomers(query.trim());
        setOptions(rows.map(r => ({ id: r.id, name: r.name, phone: r.phone })));
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          disabled={disabled}
          data-testid={testId}
          className={cn("w-full justify-between font-normal", !value && "text-muted-foreground")}
        >
          {value ? toLabel(value) : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>{loading ? "Searching…" : query.length < 2 ? "Type 2+ characters" : "No customers found"}</CommandEmpty>
            <CommandGroup>
              {options.map(opt => (
                <CommandItem
                  key={opt.id}
                  value={toLabel(opt)}
                  onSelect={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value?.id === opt.id ? "opacity-100" : "opacity-0")} />
                  <div>
                    <p>{opt.name}</p>
                    <p className="text-xs text-muted-foreground">{opt.phone}</p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
