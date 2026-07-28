import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import { searchCities, type City } from "../api";

type Props = {
  value: string;
  onChange: (city: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  testId?: string;
  className?: string;
};

export function CitySearchSelect({
  value,
  onChange,
  label = "City",
  placeholder = "Search city…",
  disabled,
  id,
  testId = "city-search-select",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<City[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      if (query.trim().length < 1) {
        setOptions([]);
        return;
      }
      setLoading(true);
      try {
        setOptions(await searchCities(query.trim()));
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query, open]);

  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            role="combobox"
            disabled={disabled}
            data-testid={testId}
            className={cn("mt-1 w-full justify-between font-normal", !value && "text-muted-foreground")}
          >
            {value || placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
            <CommandList>
              <CommandEmpty>
                {loading ? "Searching…" : query.trim().length < 1 ? "Type to search cities" : "No cities found"}
              </CommandEmpty>
              <CommandGroup>
                {options.map(city => (
                  <CommandItem
                    key={city.id}
                    value={city.name}
                    onSelect={() => {
                      onChange(city.name);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === city.name ? "opacity-100" : "opacity-0")} />
                    <div>
                      <p>{city.name}</p>
                      <p className="text-xs text-muted-foreground">{city.stateName}</p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
