import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useAdminServices, useCatalogPackages } from "@/features/service-catalog/api";
import { useServiceCategories, type ServiceCategory } from "@/features/master-data/api";
import { useDcmsPlans, type DcmsPlan } from "@/features/daily-cleaning/api";
import type { AssetListRow } from "@/features/assets/api";
import type { BookServiceKind, SelectedBookService } from "../types";
import { cn } from "@/lib/utils";
import { isDailyCleanCatalogServiceName } from "@workspace/validation";

type ServiceOption = SelectedBookService & {
  description?: string;
  /** Master-data service category slug (or synthetic key for catalog packages/plans). */
  categorySlug: string;
  categoryName: string;
};

const KIND_LABELS: Record<BookServiceKind, string> = {
  service: "One-time",
  package: "Package",
  plan: "Plan",
};

type Props = {
  asset: AssetListRow | null;
  value: SelectedBookService | null;
  onChange: (service: SelectedBookService | null) => void;
};

function formatPrice(price: string | number) {
  const n = typeof price === "number" ? price : parseFloat(price);
  return Number.isFinite(n) ? `₹${n.toLocaleString("en-IN")}` : price;
}

function isSolarMasterCategory(cat: Pick<ServiceCategory, "slug" | "legacyCategory" | "name">): boolean {
  const hay = `${cat.slug} ${cat.legacyCategory ?? ""} ${cat.name}`.toLowerCase();
  return hay.includes("solar");
}

function resolveCategoryForService(
  categories: ServiceCategory[],
  opts: { serviceCategoryId?: number; categorySlug?: string; category?: string; categoryName?: string },
): ServiceCategory | null {
  if (opts.serviceCategoryId) {
    const byId = categories.find(c => c.id === opts.serviceCategoryId);
    if (byId) return byId;
  }
  if (opts.categorySlug) {
    const bySlug = categories.find(c => c.slug === opts.categorySlug);
    if (bySlug) return bySlug;
  }
  if (opts.category) {
    const byLegacy = categories.find(c => c.legacyCategory === opts.category || c.slug === opts.category);
    if (byLegacy) return byLegacy;
  }
  if (opts.categoryName) {
    const byName = categories.find(c => c.name.toLowerCase() === opts.categoryName!.toLowerCase());
    if (byName) return byName;
  }
  return null;
}

/** Resolve master category from a catalog service linked on a package entitlement. */
function resolveCategoryFromServiceId(
  categories: ServiceCategory[],
  adminServices: Array<{
    id: number;
    serviceCategoryId?: number;
    categorySlug?: string;
    category: string;
    categoryName?: string;
  }>,
  serviceId?: number,
): ServiceCategory | null {
  if (!serviceId) return null;
  const linked = adminServices.find(s => s.id === serviceId);
  if (!linked) return null;
  return resolveCategoryForService(categories, {
    serviceCategoryId: linked.serviceCategoryId,
    categorySlug: linked.categorySlug,
    category: linked.category,
    categoryName: linked.categoryName,
  });
}

export function ServiceSelect({ asset, value, onChange }: Props) {
  const vehicleId = asset?.assetType === "vehicle" ? asset.vehicleId ?? undefined : undefined;
  const [categorySlug, setCategorySlug] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<BookServiceKind | "all">("all");

  const { data: masterCategories, isLoading: categoriesLoading } = useServiceCategories();
  const { data: adminServices, isLoading: servicesLoading } = useAdminServices();
  const { data: packages, isLoading: packagesLoading } = useCatalogPackages();
  const { data: plans, isLoading: plansLoading } = useDcmsPlans(vehicleId ?? undefined);

  const bookingCategories = useMemo(
    () => (masterCategories ?? []).filter(c => c.isActive !== false && c.showInBooking !== false),
    [masterCategories],
  );

  const options = useMemo(() => {
    if (!asset) return [] as ServiceOption[];
    const isSolar = asset.assetType === "solar_site";
    const out: ServiceOption[] = [];

    for (const s of adminServices ?? []) {
      if (s.status === "disabled" || s.status === "archived" || s.isActive === false) continue;
      if (isDailyCleanCatalogServiceName(s.name)) continue;

      const cat = resolveCategoryForService(bookingCategories, {
        serviceCategoryId: s.serviceCategoryId,
        categorySlug: s.categorySlug,
        category: s.category,
        categoryName: s.categoryName,
      });

      // Asset ↔ catalog fit via pricing model when present; else master category solar flag
      const solarByPricing = s.pricingModel === "solar_slab";
      const solarByCategory = cat ? isSolarMasterCategory(cat) : isSolarMasterCategory({
        slug: s.categorySlug ?? "",
        legacyCategory: s.category,
        name: s.categoryName ?? s.category,
      });
      const isSolarService = solarByPricing || solarByCategory;
      if (isSolar && !isSolarService) continue;
      if (!isSolar && isSolarService) continue;

      const slug = cat?.slug ?? s.categorySlug ?? s.category ?? "uncategorized";
      const name = cat?.name ?? s.categoryName ?? s.category ?? "Other";
      out.push({
        kind: "service",
        id: s.id,
        name: s.name,
        price: parseFloat(s.basePrice) || 0,
        catalogServiceId: s.id,
        solarTerm: isSolarService ? "one_time" : undefined,
        description: s.shortDescription ?? s.description,
        categorySlug: slug,
        categoryName: name,
      });
    }

    if (!isSolar) {
      for (const p of packages ?? []) {
        const ents = p.entitlements ?? [];
        const isWash = ents.some(e => e.entitlementType === "wash_credit")
          && !ents.some(e => e.entitlementType === "cleaning_credit" || e.entitlementType === "solar_visit");
        if (!isWash) continue;
        const linkedServiceId = ents.find(e => e.entitlementType === "wash_credit")?.serviceId;
        const cat = resolveCategoryFromServiceId(bookingCategories, adminServices ?? [], linkedServiceId)
          ?? bookingCategories.find(c => !isSolarMasterCategory(c))
          ?? null;
        out.push({
          kind: "package",
          id: p.id,
          name: p.name,
          price: parseFloat(p.price) || 0,
          description: p.description ?? undefined,
          categorySlug: cat?.slug ?? "uncategorized",
          categoryName: cat?.name ?? "Other",
        });
      }
      // Prefer the master category of any daily-clean catalog service (skipped as one-time above).
      const dailyCleanService = (adminServices ?? []).find(s =>
        s.isActive !== false
        && s.status !== "disabled"
        && s.status !== "archived"
        && isDailyCleanCatalogServiceName(s.name),
      );
      const planCategory = dailyCleanService
        ? resolveCategoryForService(bookingCategories, {
            serviceCategoryId: dailyCleanService.serviceCategoryId,
            categorySlug: dailyCleanService.categorySlug,
            category: dailyCleanService.category,
            categoryName: dailyCleanService.categoryName,
          })
        : bookingCategories.find(c => !isSolarMasterCategory(c)) ?? null;

      for (const plan of (plans ?? []) as DcmsPlan[]) {
        if (!plan.isActive) continue;
        out.push({
          kind: "plan",
          id: plan.id,
          name: plan.name,
          price: parseFloat(plan.price) || 0,
          description: plan.description ?? `${plan.includedCleanings} visits included`,
          categorySlug: planCategory?.slug ?? "uncategorized",
          categoryName: planCategory?.name ?? "Other",
        });
      }
    } else {
      for (const p of packages ?? []) {
        const ents = p.entitlements ?? [];
        if (!ents.some(e => e.entitlementType === "solar_visit")) continue;
        const linkedServiceId = ents.find(e => e.entitlementType === "solar_visit")?.serviceId;
        const cat = resolveCategoryFromServiceId(bookingCategories, adminServices ?? [], linkedServiceId)
          ?? bookingCategories.find(c => isSolarMasterCategory(c))
          ?? null;
        out.push({
          kind: "package",
          id: p.id,
          name: p.name,
          price: parseFloat(p.price) || 0,
          solarTerm: p.solarTerm ?? (p.validityDays >= 300 ? "amc_12" : "amc_6"),
          description: p.description ?? undefined,
          categorySlug: cat?.slug ?? "uncategorized",
          categoryName: cat?.name ?? "Other",
        });
      }
    }

    return out;
  }, [adminServices, packages, plans, asset, bookingCategories]);

  const availableCategories = useMemo(() => {
    const counts = new Map<string, { name: string; count: number; description?: string | null }>();
    for (const opt of options) {
      const prev = counts.get(opt.categorySlug);
      if (prev) {
        prev.count += 1;
      } else {
        const master = bookingCategories.find(c => c.slug === opt.categorySlug);
        counts.set(opt.categorySlug, {
          name: master?.name ?? opt.categoryName,
          count: 1,
          description: master?.description,
        });
      }
    }
    // Prefer master-data sort order when available
    const ordered = bookingCategories
      .filter(c => counts.has(c.slug))
      .map(c => ({
        slug: c.slug,
        name: c.name,
        description: c.description,
        count: counts.get(c.slug)!.count,
      }));
    for (const [slug, meta] of counts) {
      if (!ordered.some(c => c.slug === slug)) {
        ordered.push({ slug, name: meta.name, description: meta.description, count: meta.count });
      }
    }
    return ordered;
  }, [options, bookingCategories]);

  const filtered = useMemo(() => {
    return options.filter(opt => {
      if (categorySlug && opt.categorySlug !== categorySlug) return false;
      if (kindFilter !== "all" && opt.kind !== kindFilter) return false;
      return true;
    });
  }, [options, categorySlug, kindFilter]);

  const availableKinds = useMemo(() => {
    const inCategory = options.filter(o => !categorySlug || o.categorySlug === categorySlug);
    const kinds = new Set(inCategory.map(o => o.kind));
    return (["service", "package", "plan"] as BookServiceKind[]).filter(k => kinds.has(k));
  }, [options, categorySlug]);

  useEffect(() => {
    setCategorySlug(null);
    setKindFilter("all");
  }, [asset?.id]);

  useEffect(() => {
    if (!asset || categorySlug) return;
    if (availableCategories.length === 1) {
      setCategorySlug(availableCategories[0]!.slug);
    }
  }, [asset, availableCategories, categorySlug]);

  useEffect(() => {
    if (value || !categorySlug || filtered.length !== 1) return;
    const only = filtered[0]!;
    onChange({
      kind: only.kind,
      id: only.id,
      name: only.name,
      price: only.price,
      catalogServiceId: only.catalogServiceId,
    });
  }, [categorySlug, filtered, value, onChange]);

  const isLoading = categoriesLoading || servicesLoading || packagesLoading || plansLoading;

  if (!asset) {
    return <p className="text-sm text-muted-foreground">Select what needs service first.</p>;
  }

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  if (options.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No services available for this asset. Check the Service Catalog is set up for your branch.
      </p>
    );
  }

  if (!categorySlug) {
    return (
      <div className="space-y-4" data-testid="book-step-service">
        <div>
          <Label className="text-base">What would the customer like today?</Label>
          <p className="text-sm text-muted-foreground mt-0.5">
            Categories come from Master Data — only offerings that fit this asset are shown.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {availableCategories.map(cat => (
            <button
              key={cat.slug}
              type="button"
              onClick={() => setCategorySlug(cat.slug)}
              data-testid={`book-service-category-${cat.slug}`}
              className="min-h-[5.5rem] rounded-lg border border-border px-4 py-4 text-left transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <p className="font-medium text-sm">{cat.name}</p>
              {cat.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{cat.description}</p>
              )}
              <p className="text-[11px] text-muted-foreground mt-2">{cat.count} available</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const categoryMeta = availableCategories.find(c => c.slug === categorySlug);

  return (
    <div className="space-y-4" data-testid="book-step-service">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Label className="text-base">{categoryMeta?.name ?? "Services"}</Label>
          <p className="text-sm text-muted-foreground mt-0.5">
            Choose one offering from the catalog. Filter by product type when needed.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-xs shrink-0"
          onClick={() => {
            setCategorySlug(null);
            setKindFilter("all");
          }}
        >
          <ChevronLeft size={14} className="mr-1" /> Categories
        </Button>
      </div>

      {availableKinds.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Catalog product type">
          <button
            type="button"
            role="tab"
            aria-selected={kindFilter === "all"}
            onClick={() => setKindFilter("all")}
            data-testid="book-offer-type-all"
            className={cn(
              "min-h-9 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              kindFilter === "all" ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:border-primary/40",
            )}
          >
            All
            <span className="ml-1 opacity-70">
              ({options.filter(o => o.categorySlug === categorySlug).length})
            </span>
          </button>
          {availableKinds.map(kind => {
            const count = options.filter(o => o.categorySlug === categorySlug && o.kind === kind).length;
            return (
              <button
                key={kind}
                type="button"
                role="tab"
                aria-selected={kindFilter === kind}
                onClick={() => setKindFilter(kind)}
                data-testid={`book-offer-type-${kind}`}
                className={cn(
                  "min-h-9 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                  kindFilter === kind ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:border-primary/40",
                )}
              >
                {KIND_LABELS[kind]}
                <span className="ml-1 opacity-70">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No offerings in this filter. Try another type.</p>
      ) : (
        <div className="grid gap-2 max-h-80 overflow-y-auto pr-1" role="listbox" aria-label="Available services">
          {filtered.map(opt => {
            const selected = value?.kind === opt.kind && value?.id === opt.id;
            const key = `${opt.kind}-${opt.id}`;
            return (
              <button
                key={key}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => onChange({
                  kind: opt.kind,
                  id: opt.id,
                  name: opt.name,
                  price: opt.price,
                  catalogServiceId: opt.catalogServiceId,
                })}
                data-testid={`book-service-option-${key}`}
                className={cn(
                  "text-left border rounded-lg px-4 py-3 transition-colors min-h-14",
                  selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{opt.name}</p>
                    {opt.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{opt.description}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant="outline" className="text-xs mb-1">{KIND_LABELS[opt.kind]}</Badge>
                    <p className="text-sm font-semibold">{formatPrice(opt.price)}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
