import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAdminServices, useCatalogPackages } from "@/features/service-catalog/api";
import { useDcmsPlans, type DcmsPlan } from "@/features/daily-cleaning/api";
import type { AssetListRow } from "@/features/assets/api";
import type { SelectedBookService } from "../types";
import { cn } from "@/lib/utils";

type ServiceOption = SelectedBookService & { description?: string };

type Props = {
  asset: AssetListRow | null;
  value: SelectedBookService | null;
  onChange: (service: SelectedBookService | null) => void;
};

function isSolarCategory(category: string, slug?: string) {
  const c = (category + (slug ?? "")).toLowerCase();
  return c.includes("solar");
}

function formatPrice(price: string | number) {
  const n = typeof price === "number" ? price : parseFloat(price);
  return Number.isFinite(n) ? `₹${n.toLocaleString("en-IN")}` : price;
}

export function ServiceSelect({ asset, value, onChange }: Props) {
  const vehicleId = asset?.assetType === "vehicle" ? asset.vehicleId ?? undefined : undefined;

  const { data: adminServices, isLoading: servicesLoading } = useAdminServices();
  const { data: packages, isLoading: packagesLoading } = useCatalogPackages();
  const { data: plans, isLoading: plansLoading } = useDcmsPlans(vehicleId ?? undefined);

  const options = useMemo(() => {
    if (!asset) return [] as ServiceOption[];
    const isSolar = asset.assetType === "solar_site";
    const out: ServiceOption[] = [];

    for (const s of adminServices ?? []) {
      if (s.status === "disabled" || s.status === "archived" || s.isActive === false) continue;
      const solar = isSolarCategory(s.category, s.categorySlug);
      if (isSolar && !solar) continue;
      if (!isSolar && solar) continue;
      const price = parseFloat(s.basePrice) || 0;
      out.push({
        kind: "service",
        id: s.id,
        name: s.name,
        price,
        catalogServiceId: s.id,
        description: s.shortDescription ?? s.description,
      });
    }

    if (!isSolar) {
      for (const p of packages ?? []) {
        const ents = p.entitlements ?? [];
        const isWash = ents.some(e => e.entitlementType === "wash_credit")
          && !ents.some(e => e.entitlementType === "cleaning_credit" || e.entitlementType === "solar_visit");
        if (!isWash) continue;
        out.push({
          kind: "package",
          id: p.id,
          name: p.name,
          price: parseFloat(p.price) || 0,
          description: p.description ?? undefined,
        });
      }
      for (const plan of (plans ?? []) as DcmsPlan[]) {
        if (!plan.isActive) continue;
        out.push({
          kind: "plan",
          id: plan.id,
          name: plan.name,
          price: parseFloat(plan.price) || 0,
          description: plan.description ?? `${plan.includedCleanings} visits included`,
        });
      }
    } else {
      for (const p of packages ?? []) {
        const ents = p.entitlements ?? [];
        if (!ents.some(e => e.entitlementType === "solar_visit")) continue;
        out.push({
          kind: "package",
          id: p.id,
          name: p.name,
          price: parseFloat(p.price) || 0,
          description: p.description ?? undefined,
        });
      }
    }

    return out;
  }, [adminServices, packages, plans, asset]);

  const isLoading = servicesLoading || packagesLoading || plansLoading;

  if (!asset) {
    return <p className="text-sm text-muted-foreground">Select a vehicle or solar site first.</p>;
  }

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  if (options.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No services available for this vehicle or site. Check the Service Catalog is set up for your branch.
      </p>
    );
  }

  const kindLabel = (kind: SelectedBookService["kind"]) => {
    if (kind === "package") return "Package";
    if (kind === "plan") return "Plan";
    return "Service";
  };

  return (
    <div className="space-y-3" data-testid="book-step-service">
      <div>
        <Label>What service are you booking?</Label>
        <p className="text-sm text-muted-foreground mt-0.5">
          Car wash, packages, daily cleaning plans, and solar — prices from HQ catalog.
        </p>
      </div>
      <div className="grid gap-2 max-h-80 overflow-y-auto pr-1">
        {options.map(opt => {
          const selected = value?.kind === opt.kind && value?.id === opt.id;
          const key = `${opt.kind}-${opt.id}`;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange({
                kind: opt.kind,
                id: opt.id,
                name: opt.name,
                price: opt.price,
                catalogServiceId: opt.catalogServiceId,
              })}
              data-testid={`book-service-option-${key}`}
              className={cn(
                "text-left border rounded-lg px-4 py-3 transition-colors",
                selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-sm">{opt.name}</p>
                  {opt.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{opt.description}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <Badge variant="outline" className="text-xs mb-1">{kindLabel(opt.kind)}</Badge>
                  <p className="text-sm font-semibold">{formatPrice(opt.price)}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
