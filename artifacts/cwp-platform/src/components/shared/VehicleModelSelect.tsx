import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useVehicleBrands, useVehicleModels, type VehicleModel } from "@/features/master-data/api";
import { Car, Loader2 } from "lucide-react";

interface Props {
  brandId?: number;
  modelId?: number;
  onSelect: (model: VehicleModel) => void;
  className?: string;
}

export function VehicleModelSelect({ modelId, onSelect, className }: Props) {
  const [brandQuery, setBrandQuery] = useState("");
  const [modelQuery, setModelQuery] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState<number | undefined>();

  const { data: brands, isLoading: loadingBrands } = useVehicleBrands(brandQuery || undefined);
  const { data: models, isLoading: loadingModels } = useVehicleModels({
    brandId: selectedBrandId,
    q: modelQuery || undefined,
  });

  const selectedModel = useMemo(() => models?.find(m => m.id === modelId), [models, modelId]);

  const filteredBrands = useMemo(() => {
    if (!brandQuery) return brands ?? [];
    return (brands ?? []).filter(b => b.name.toLowerCase().includes(brandQuery.toLowerCase()));
  }, [brands, brandQuery]);

  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      <div className="flex items-center gap-2">
        <Car size={14} className="text-primary" />
        <Label className="font-semibold text-sm">Vehicle Make & Model</Label>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Search brand</Label>
        <Input
          className="mt-1"
          value={brandQuery}
          onChange={e => { setBrandQuery(e.target.value); setSelectedBrandId(undefined); }}
          placeholder="e.g. Hyundai, Maruti Suzuki"
          data-testid="input-vehicle-brand-search"
        />
        {loadingBrands ? <Loader2 size={14} className="animate-spin mt-1" /> : (
          <div className="flex flex-wrap gap-1.5 mt-2 max-h-24 overflow-y-auto">
            {filteredBrands.slice(0, 12).map(b => (
              <button
                key={b.id}
                type="button"
                onClick={() => { setSelectedBrandId(b.id); setBrandQuery(b.name); setModelQuery(""); }}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  selectedBrandId === b.id ? "bg-primary text-secondary border-primary" : "border-border hover:border-primary/50"
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedBrandId && (
        <div>
          <Label className="text-xs text-muted-foreground">Search model</Label>
          <Input
            className="mt-1"
            value={modelQuery}
            onChange={e => setModelQuery(e.target.value)}
            placeholder="e.g. Creta, Swift, Innova"
            data-testid="input-vehicle-model-search"
          />
          {loadingModels ? <Loader2 size={14} className="animate-spin mt-1" /> : (
            <div className="space-y-1 mt-2 max-h-40 overflow-y-auto">
              {(models ?? []).map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelect(m)}
                  className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                    modelId === m.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                  }`}
                  data-testid={`vehicle-model-${m.id}`}
                >
                  <span className="font-medium">{m.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {m.categoryName} · {m.seatName}
                  </span>
                </button>
              ))}
              {(models ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground py-2">No models found. Try a different search.</p>
              )}
            </div>
          )}
        </div>
      )}

      {selectedModel && (
        <div className="bg-muted/50 rounded-lg px-3 py-2 text-sm">
          <span className="font-medium">{selectedModel.brandName} {selectedModel.name}</span>
          <span className="text-muted-foreground ml-2">
            → {selectedModel.categoryName} · {selectedModel.seatName}
          </span>
          <p className="text-xs text-muted-foreground mt-0.5">Category auto-detected for pricing</p>
        </div>
      )}
    </div>
  );
}
