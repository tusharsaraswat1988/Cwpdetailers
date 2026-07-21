import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useVehicleBrands, useVehicleModels, type VehicleModel } from "@/features/master-data/api";
import { Car, Loader2, Search, X } from "lucide-react";

interface Props {
  modelId?: number;
  selected?: VehicleModel | null;
  onSelect: (model: VehicleModel | null) => void;
  className?: string;
}

export function VehicleModelSelect({ modelId, selected, onSelect, className }: Props) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [brandFilterId, setBrandFilterId] = useState<number | undefined>();

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const brandSearch = debouncedQuery.length >= 1 ? debouncedQuery : undefined;
  const { data: brands, isLoading: loadingBrands, isError: brandsError } = useVehicleBrands(brandSearch);

  const modelSearchEnabled = debouncedQuery.length >= 2 || brandFilterId != null;
  const modelQueryOpts = useMemo(() => {
    if (brandFilterId && debouncedQuery.length < 2) {
      return { brandId: brandFilterId };
    }
    if (debouncedQuery.length >= 2) {
      return { q: debouncedQuery, brandId: brandFilterId };
    }
    return undefined;
  }, [brandFilterId, debouncedQuery]);

  const {
    data: models,
    isLoading: loadingModels,
    isError: modelsError,
  } = useVehicleModels(modelQueryOpts, modelSearchEnabled);

  const selectedModel = selected ?? models?.find(m => m.id === modelId) ?? null;

  const visibleBrands = useMemo(() => (brands ?? []).slice(0, 16), [brands]);
  const visibleModels = models ?? [];

  const handleSelectModel = (model: VehicleModel) => {
    onSelect(model);
    setQuery("");
    setDebouncedQuery("");
    setBrandFilterId(undefined);
  };

  const handleClear = () => {
    onSelect(null);
    setQuery("");
    setDebouncedQuery("");
    setBrandFilterId(undefined);
  };

  const handleBrandChip = (brandId: number, brandName: string) => {
    setBrandFilterId(brandId);
    setQuery(brandName);
    setDebouncedQuery(brandName);
    onSelect(null);
  };

  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      <div className="flex items-center gap-2">
        <Car size={14} className="text-primary" />
        <Label className="font-semibold text-sm">Vehicle make & model *</Label>
      </div>

      {selectedModel ? (
        <div className="rounded-lg border border-primary/40 bg-primary/5 px-3 py-2.5 text-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium">
                {selectedModel.brandName} {selectedModel.name}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedModel.categoryName} · {selectedModel.seatName} seats
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Category auto-detected for pricing</p>
            </div>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleClear} aria-label="Clear selection">
              <X size={14} />
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div>
            <Label className="text-xs text-muted-foreground">Search from master data</Label>
            <div className="relative mt-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={query}
                onChange={e => {
                  setQuery(e.target.value);
                  setBrandFilterId(undefined);
                }}
                placeholder="Type brand or model — e.g. Hyundai Creta, Maruti Swift"
                data-testid="input-vehicle-brand-search"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Pick a result below. Brands and models come from Admin → Master Data.
            </p>
          </div>

          {!debouncedQuery && (
            <div>
              <Label className="text-xs text-muted-foreground">Popular brands</Label>
              {loadingBrands ? (
                <Loader2 size={14} className="animate-spin mt-2" />
              ) : brandsError ? (
                <p className="text-xs text-destructive mt-2">Could not load brands. Refresh and try again.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 mt-2 max-h-24 overflow-y-auto">
                  {visibleBrands.map(b => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => handleBrandChip(b.id, b.name)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        brandFilterId === b.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {b.name}
                    </button>
                  ))}
                  {visibleBrands.length === 0 && (
                    <p className="text-xs text-muted-foreground">No brands in master data yet.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {modelSearchEnabled && (
            <div>
              <Label className="text-xs text-muted-foreground">
                {brandFilterId && debouncedQuery.length < 2 ? "Models for selected brand" : "Matching models"}
              </Label>
              {loadingModels ? (
                <Loader2 size={14} className="animate-spin mt-2" />
              ) : modelsError ? (
                <p className="text-xs text-destructive mt-2">Could not load models. Refresh and try again.</p>
              ) : (
                <div className="space-y-1 mt-2 max-h-48 overflow-y-auto rounded-lg border border-border p-1">
                  {visibleModels.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleSelectModel(m)}
                      className="w-full text-left px-3 py-2 rounded-md border border-transparent hover:border-primary/40 hover:bg-muted/50 text-sm transition-colors"
                      data-testid={`vehicle-model-${m.id}`}
                    >
                      <span className="font-medium">{m.brandName} {m.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {m.categoryName} · {m.seatName}
                      </span>
                    </button>
                  ))}
                  {visibleModels.length === 0 && (
                    <p className="text-xs text-muted-foreground px-3 py-2">
                      No models found. Try another brand or search term.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {debouncedQuery.length === 1 && (
            <p className="text-xs text-muted-foreground">Type at least 2 characters to search models.</p>
          )}
        </>
      )}
    </div>
  );
};
