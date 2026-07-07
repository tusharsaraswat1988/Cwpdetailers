import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, isValid } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Loader2, CheckCircle2 } from "lucide-react";
import {
  searchWalkIn,
  fetchWalkInCustomer,
  resolveWalkIn,
  resolveWalkInNavigation,
  type WalkInIncludedService,
  type WalkInPackageCard,
  type WalkInCustomerContext,
  type WalkInServiceKind,
} from "@/features/staff-walk-in/api";
import { getStaffLocation } from "@/lib/location";
import { SERVICE_EXECUTIONS_QUERY_KEY } from "@/features/service-executions/api";
import { getGetTodayBookingsQueryKey } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

const SEARCH_MIN_CHARS = 3;
const SEARCH_DEBOUNCE_MS = 300;

type Props = {
  onBookingResolved: (bookingId: number, serviceKind: WalkInIncludedService["serviceKind"]) => void;
  onDcmsResolved: (subscriptionId: number, visitType: "cleaning") => void;
  successMessage?: string | null;
  onDismissSuccess?: () => void;
};

function formatExpiry(value: string | null | undefined) {
  if (!value) return "—";
  const d = parseISO(value.length === 10 ? `${value}T00:00:00` : value);
  return isValid(d) ? format(d, "d MMM yyyy") : value;
}

function formatPrice(value: string | null | undefined) {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? `₹${n.toLocaleString("en-IN")}` : null;
}

function serviceIcon(kind: WalkInServiceKind) {
  switch (kind) {
    case "daily_clean": return "🧹";
    case "daily_wash":
    case "car_wash": return "🚗";
    case "solar_clean": return "☀️";
    default: return "•";
  }
}

function serviceStatusInfo(service: WalkInIncludedService) {
  if (service.status === "not_active") {
    return { label: "Package Nahi Hai", tone: "muted" as const };
  }
  if (service.status === "expired") {
    return { label: "Expired", tone: "danger" as const };
  }
  if (service.status === "exhausted" || service.remaining <= 0) {
    return { label: "Khatam", tone: "muted" as const };
  }
  if (service.recommended) {
    return { label: "Aaj Karna Hai", tone: "recommended" as const };
  }
  return { label: "Available", tone: "available" as const };
}

function membershipLabel(status: WalkInCustomerContext["membershipStatus"]) {
  switch (status) {
    case "active": return "Package Active";
    case "none": return "Package Nahi Hai";
    case "inactive": return "Inactive";
    case "suspended": return "Suspended";
  }
}

function CustomerHeader({ context, onChange }: { context: WalkInCustomerContext; onChange: () => void }) {
  const vehicle = context.vehicle;
  const pkg = context.primaryPackage;
  const priceLabel = pkg ? formatPrice(pkg.packagePrice) : null;

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <p className="text-base font-semibold truncate">{context.customer.name}</p>
          {vehicle && (
            <p className="text-sm font-medium truncate">
              {vehicle.registrationNumber}
              {(vehicle.make || vehicle.model) && (
                <span className="font-normal text-muted-foreground">
                  {" · "}{[vehicle.make, vehicle.model].filter(Boolean).join(" ")}
                </span>
              )}
            </p>
          )}
          {pkg && (
            <p className="text-sm">
              {pkg.packageName}
              {priceLabel && <span className="text-muted-foreground"> {priceLabel}</span>}
            </p>
          )}
          {pkg?.validTill && (
            <p className="text-xs text-muted-foreground">
              Valid tak {formatExpiry(pkg.validTill)}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            ID {context.customer.id}
            {context.customer.branchName && ` · ${context.customer.branchName}`}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={onChange}>
          Badlo
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant={context.membershipStatus === "active" ? "default" : "outline"}>
          {membershipLabel(context.membershipStatus)}
        </Badge>
      </div>
    </div>
  );
}

function ServiceStatusBadge({ service }: { service: WalkInIncludedService }) {
  const info = serviceStatusInfo(service);
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] shrink-0",
        info.tone === "recommended" && "border-primary/50 bg-primary/10 text-primary",
        info.tone === "available" && "border-green-500/30 bg-green-500/10 text-green-800",
        info.tone === "danger" && "border-destructive/30 bg-destructive/10 text-destructive",
        info.tone === "muted" && "text-muted-foreground",
      )}
    >
      {info.tone === "recommended" && <CheckCircle2 size={10} className="mr-1 inline" />}
      {info.label}
    </Badge>
  );
}

function PackageCard({
  pkg,
  resolvingKey,
  onStartService,
  onCreateDraft,
}: {
  pkg: WalkInPackageCard;
  resolvingKey: string | null;
  onStartService: (service: WalkInIncludedService) => void;
  onCreateDraft: (service: WalkInIncludedService) => void;
}) {
  const priceLabel = formatPrice(pkg.packagePrice);
  const hasActiveService = pkg.includedServices.some(s => s.status === "active" && s.remaining > 0);
  const isSolarOnly = pkg.source == null && pkg.packageName === "Solar";

  if (isSolarOnly) {
    const service = pkg.includedServices[0]!;
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">
            {serviceIcon(service.serviceKind)} {service.displayName}
          </p>
          <ServiceStatusBadge service={service} />
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          size="sm"
          disabled={resolvingKey === service.key}
          onClick={() => onCreateDraft(service)}
        >
          {resolvingKey === service.key ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
          Draft Booking Banao
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">
            {pkg.packageName}
            {priceLabel && <span className="font-normal text-muted-foreground"> {priceLabel}</span>}
          </p>
          {pkg.vehicleLabel && <p className="text-xs text-muted-foreground">{pkg.vehicleLabel}</p>}
        </div>
      </div>

      {pkg.expiresAt && (
        <p className="text-xs text-muted-foreground">Valid tak {formatExpiry(pkg.expiresAt)}</p>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Package mein shamil</p>
        {pkg.includedServices.map(service => {
          const canStart = service.status === "active" && service.remaining > 0;
          const showDraft = !canStart && (service.status === "exhausted" || service.status === "expired" || service.status === "not_active");
          const totalLabel = service.total != null ? `${service.remaining} / ${service.total}` : String(service.remaining);

          return (
            <div key={service.key} className="rounded-lg border border-border/80 bg-muted/20 p-2.5 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">
                  {serviceIcon(service.serviceKind)} {service.displayName}
                </p>
                <ServiceStatusBadge service={service} />
              </div>
              <p className="text-xs text-muted-foreground">Baki: {totalLabel}</p>
              {canStart && (
                <Button
                  type="button"
                  className="w-full"
                  size="sm"
                  disabled={resolvingKey === service.key}
                  onClick={() => onStartService(service)}
                >
                  {resolvingKey === service.key ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
                  Kaam Shuru Karo
                </Button>
              )}
              {showDraft && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  size="sm"
                  disabled={resolvingKey === service.key}
                  onClick={() => onCreateDraft(service)}
                >
                  {resolvingKey === service.key ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
                  Draft Booking Banao
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {!hasActiveService && pkg.source != null && pkg.includedServices.every(s => s.status === "exhausted" || s.status === "expired") && (
        <p className="text-xs text-muted-foreground">Package khatam — admin ke liye draft booking banao.</p>
      )}
    </div>
  );
}

export function StaffWalkInPanel({ onBookingResolved, onDcmsResolved, successMessage, onDismissSuccess }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Awaited<ReturnType<typeof searchWalkIn>> | null>(null);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [vehicleId, setVehicleId] = useState<number | undefined>();
  const [resolvingKey, setResolvingKey] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: context, isLoading: loadingContext } = useQuery({
    queryKey: ["walk-in-customer", customerId, vehicleId],
    queryFn: () => fetchWalkInCustomer(customerId!, vehicleId),
    enabled: customerId != null,
  });

  useEffect(() => {
    if (customerId) return;
    const trimmed = query.trim();
    if (trimmed.length < SEARCH_MIN_CHARS) {
      setSearchResults(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearching(true);
      void searchWalkIn(trimmed)
        .then(results => {
          setSearchResults(results);
          if (results.customers.length === 0 && results.vehicles.length === 0) {
            toast({ title: "Customer nahi mila", description: "Phone ya number plate try karo", variant: "destructive" });
          }
        })
        .catch(e => {
          toast({ title: "Search fail", description: (e as Error).message, variant: "destructive" });
        })
        .finally(() => setSearching(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, customerId, toast]);

  function pickCustomer(id: number, vId?: number) {
    setCustomerId(id);
    setVehicleId(vId);
    setSearchResults(null);
    setQuery("");
  }

  function resetCustomer() {
    setCustomerId(null);
    setVehicleId(undefined);
    setSearchResults(null);
    setQuery("");
  }

  async function handleAction(
    pkg: WalkInPackageCard,
    service: WalkInIncludedService,
    forceDraft: boolean,
  ) {
    if (!customerId) return;
    setResolvingKey(service.key);
    try {
      const gps = await getStaffLocation("action");

      const result = await resolveWalkIn({
        customerId,
        serviceKind: service.serviceKind,
        vehicleId: pkg.vehicleId ?? vehicleId,
        solarSiteId: service.solarSiteId,
        entitlementId: forceDraft ? undefined : service.entitlementId,
        subscriptionId: forceDraft ? undefined : service.subscriptionId,
        legacySubscriptionId: forceDraft ? undefined : service.legacySubscriptionId,
        latitude: gps.latitude,
        longitude: gps.longitude,
        accuracy: gps.accuracy,
        forceDraft,
      });

      qc.invalidateQueries({ queryKey: getGetTodayBookingsQueryKey() });
      qc.invalidateQueries({ queryKey: SERVICE_EXECUTIONS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: ["walk-in-customer", customerId] });

      const navigation = resolveWalkInNavigation(service.serviceKind, result);

      if (navigation.route === "daily_clean") {
        toast({ title: "Daily Clean khul raha hai", description: "Wahi workflow use karo jo assigned jobs mein hai" });
        onDcmsResolved(navigation.subscriptionId, navigation.visitType);
        resetCustomer();
        return;
      }

      toast({
        title: result.createdDraft ? "Draft booking ban gayi" : "Service shuru",
        description: result.message,
      });
      onBookingResolved(navigation.bookingId, navigation.serviceKind);
      resetCustomer();
    } catch (e) {
      toast({
        title: forceDraft ? "Draft booking fail" : "Service start fail",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setResolvingKey(null);
    }
  }

  async function handleNoPackageDraft() {
    if (!customerId) return;
    setResolvingKey("no-package");
    try {
      const gps = await getStaffLocation("action");
      const result = await resolveWalkIn({
        customerId,
        serviceKind: "car_wash",
        vehicleId,
        latitude: gps.latitude,
        longitude: gps.longitude,
        accuracy: gps.accuracy,
        forceDraft: true,
      });
      qc.invalidateQueries({ queryKey: getGetTodayBookingsQueryKey() });
      toast({
        title: "Draft booking ban gayi",
        description: result.mode === "booking" ? result.message : "Admin payment confirm karega",
      });
      if (result.mode === "booking") {
        onBookingResolved(result.bookingId, "car_wash");
        resetCustomer();
      }
    } catch (e) {
      toast({ title: "Draft booking fail", description: (e as Error).message, variant: "destructive" });
    } finally {
      setResolvingKey(null);
    }
  }

  return (
    <section className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <UserPlus size={18} className="text-primary" />
        <div>
          <p className="font-semibold text-sm">Walk-in Entry</p>
          <p className="text-xs text-muted-foreground">Customer khojo — package dekho — kaam shuru karo</p>
        </div>
      </div>

      {successMessage && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3 space-y-1">
          <p className="text-sm font-semibold text-green-800 flex items-center gap-1.5">
            <CheckCircle2 size={16} /> Kaam complete ho gaya
          </p>
          <p className="text-xs text-green-700">{successMessage}</p>
          {onDismissSuccess && (
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-green-800" onClick={onDismissSuccess}>
              Agla customer khojo
            </Button>
          )}
        </div>
      )}

      {!customerId ? (
        <>
          <Input
            placeholder="Phone, naam ya number plate (min 3 akshar)..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {searching && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" /> Dhundh rahe hain…
            </p>
          )}
          {searchResults && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {searchResults.customers.map(c => (
                <button
                  key={c.id}
                  type="button"
                  className="w-full text-left rounded-lg border border-border bg-card px-3 py-2 text-sm hover:border-primary/40"
                  onClick={() => pickCustomer(c.id)}
                >
                  {c.label}
                </button>
              ))}
              {searchResults.vehicles.map(v => (
                <button
                  key={v.id}
                  type="button"
                  className="w-full text-left rounded-lg border border-border bg-card px-3 py-2 text-sm hover:border-primary/40"
                  onClick={() => pickCustomer(v.customerId, v.id)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}
        </>
      ) : loadingContext || !context ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
          <Loader2 size={14} className="animate-spin" /> Package load ho raha hai…
        </div>
      ) : (
        <>
          <CustomerHeader context={context} onChange={resetCustomer} />

          {context.vehicles.length > 1 && !vehicleId && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Gaadi chuno</p>
              {context.vehicles.map(v => (
                <button
                  key={v.id}
                  type="button"
                  className="w-full text-left rounded-lg border border-border bg-card px-3 py-2 text-sm hover:border-primary/40"
                  onClick={() => setVehicleId(v.id)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2">
            {context.packages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-4 text-center space-y-3">
                <p className="text-sm text-muted-foreground">Koi package active nahi</p>
                <Button
                  type="button"
                  className="w-full"
                  disabled={resolvingKey != null}
                  onClick={() => void handleNoPackageDraft()}
                >
                  {resolvingKey === "no-package" ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
                  Draft Booking Banao
                </Button>
              </div>
            ) : (
              context.packages.map(pkg => (
                <PackageCard
                  key={pkg.key}
                  pkg={pkg}
                  resolvingKey={resolvingKey}
                  onStartService={service => void handleAction(pkg, service, false)}
                  onCreateDraft={service => void handleAction(pkg, service, true)}
                />
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
}
