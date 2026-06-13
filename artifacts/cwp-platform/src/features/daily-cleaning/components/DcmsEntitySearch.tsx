import { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import { dcmsFetch } from "../api";

export type SearchOption = { id: number; label: string; meta?: string };

type Props = {
  type: "customers" | "vehicles" | "staff" | "subscriptions";
  value: SearchOption | null;
  onChange: (option: SearchOption | null) => void;
  placeholder?: string;
  disabled?: boolean;
  vehicleFilters?: { customerId?: number; registration?: string; brand?: string; model?: string };
};

async function fetchOptions(type: Props["type"], query: string, vehicleFilters?: Props["vehicleFilters"]): Promise<SearchOption[]> {
  if (query.length < 2 && type !== "vehicles") return [];
  const paths: Record<Props["type"], string> = {
    customers: `/daily-cleaning/search/customers?q=${encodeURIComponent(query)}`,
    vehicles: `/daily-cleaning/search/vehicles?q=${encodeURIComponent(query)}${vehicleFilters?.customerId ? `&customerId=${vehicleFilters.customerId}` : ""}${vehicleFilters?.registration ? `&registration=${encodeURIComponent(vehicleFilters.registration)}` : ""}${vehicleFilters?.brand ? `&brand=${encodeURIComponent(vehicleFilters.brand)}` : ""}${vehicleFilters?.model ? `&model=${encodeURIComponent(vehicleFilters.model)}` : ""}`,
    staff: `/daily-cleaning/search/staff?q=${encodeURIComponent(query)}`,
    subscriptions: `/daily-cleaning/search/subscriptions?q=${encodeURIComponent(query)}`,
  };
  const rows = await dcmsFetch<Array<{ id: number; label: string; phone?: string; customerName?: string }>>(paths[type]);
  return rows.map(r => ({ id: r.id, label: r.label, meta: r.phone ?? r.customerName }));
}

export function DcmsEntitySearch({ type, value, onChange, placeholder, disabled, vehicleFilters }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<SearchOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        setOptions(await fetchOptions(type, query, vehicleFilters));
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, open, type, vehicleFilters?.customerId]);

  const hints: Record<Props["type"], string> = {
    customers: "Search by name or mobile…",
    vehicles: "Registration, brand, or model…",
    staff: "Search by name or mobile…",
    subscriptions: "Customer or vehicle registration…",
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn("w-full justify-between font-normal", !value && "text-muted-foreground")}
        >
          {value?.label ?? placeholder ?? hints[type]}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={hints[type]} value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>{loading ? "Searching…" : "No results"}</CommandEmpty>
            <CommandGroup>
              {options.map(opt => (
                <CommandItem
                  key={opt.id}
                  value={opt.label}
                  onSelect={() => { onChange(opt); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value?.id === opt.id ? "opacity-100" : "opacity-0")} />
                  <div>
                    <p>{opt.label}</p>
                    {opt.meta && <p className="text-xs text-muted-foreground">{opt.meta}</p>}
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
