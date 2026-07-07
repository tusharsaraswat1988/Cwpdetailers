import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, isValid } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, UserPlus, Loader2, Camera, CheckCircle2, Circle } from "lucide-react";
import {
  searchWalkIn,
  fetchWalkInCustomer,
  resolveWalkIn,
  type WalkInEntitlementCard,
  type WalkInCustomerContext,
} from "@/features/staff-walk-in/api";
import { useCompleteVisit } from "@/features/daily-cleaning/api";
import { getStaffLocation } from "@/lib/location";
import { validateCameraFile, readFileAsDataUrl, extractClientExif } from "@/features/daily-cleaning/lib/cameraCapture";
import { SERVICE_EXECUTIONS_QUERY_KEY } from "@/features/service-executions/api";
import { getGetTodayBookingsQueryKey } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

type Props = {
  onBookingResolved: (bookingId: number) => void;
  onDcmsResolved: (subscriptionId: number, visitType: "cleaning" | "wash") => void;
};

function formatExpiry(value: string | null | undefined) {
  if (!value) return "—";
  const d = parseISO(value.length === 10 ? `${value}T00:00:00` : value);
  return isValid(d) ? format(d, "d MMM") : value;
}

function statusLabel(status: WalkInEntitlementCard["status"]) {
  switch (status) {
    case "active": return "Active";
    case "exhausted": return "Package Finished";
    case "expired": return "Expired";
    case "not_active": return "Not Active";
    default: return "Inactive";
  }
}

function statusBadgeVariant(status: WalkInEntitlementCard["status"]) {
  switch (status) {
    case "active": return "default" as const;
    case "exhausted": return "secondary" as const;
    case "expired": return "outline" as const;
    default: return "outline" as const;
  }
}

function membershipLabel(status: WalkInCustomerContext["membershipStatus"]) {
  switch (status) {
    case "active": return "Active";
    case "none": return "No Package";
    case "inactive": return "Inactive";
    case "suspended": return "Suspended";
  }
}

function CustomerHeader({ context, onChange }: { context: WalkInCustomerContext; onChange: () => void }) {
  const vehicle = context.vehicle;
  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          {vehicle && (
            <p className="text-sm font-semibold truncate">
              {vehicle.registrationNumber}
              {(vehicle.make || vehicle.model) && (
                <span className="font-normal text-muted-foreground">
                  {" · "}{[vehicle.make, vehicle.model].filter(Boolean).join(" ")}
                </span>
              )}
            </p>
          )}
          <p className="text-sm">
            <span className="text-muted-foreground">Customer </span>
            {context.customer.name}
          </p>
          <p className="text-xs text-muted-foreground">
            ID {context.customer.id}
            {context.customer.branchName && ` · ${context.customer.branchName}`}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={onChange}>
          Change
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant={context.membershipStatus === "active" ? "default" : "outline"}>
          Membership {membershipLabel(context.membershipStatus)}
        </Badge>
        {context.customer.city && (
          <Badge variant="outline">{context.customer.city}</Badge>
        )}
      </div>
    </div>
  );
}

function EntitlementCard({
  card,
  resolving,
  onStartService,
  onCreateDraft,
}: {
  card: WalkInEntitlementCard;
  resolving: boolean;
  onStartService: () => void;
  onCreateDraft: () => void;
}) {
  const canStart = card.status === "active" && card.remaining > 0;
  const showDraft = card.status === "exhausted" || card.status === "expired" || card.status === "not_active";

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{card.displayName}</p>
          {card.packageName && (
            <p className="text-xs text-muted-foreground">{card.packageName}</p>
          )}
          {card.vehicleLabel && (
            <p className="text-xs text-muted-foreground">{card.vehicleLabel}</p>
          )}
        </div>
        <Badge variant={statusBadgeVariant(card.status)} className="text-[10px] shrink-0">
          {statusLabel(card.status)}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Remaining</p>
          <p className="font-semibold text-base">{card.remaining}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Expires</p>
          <p className="font-medium">{formatExpiry(card.expiresAt)}</p>
        </div>
      </div>

      {canStart && (
        <Button type="button" className="w-full" size="sm" disabled={resolving} onClick={onStartService}>
          {resolving ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
          Start Service
        </Button>
      )}

      {showDraft && (
        <Button
          type="button"
          variant={card.status === "not_active" ? "default" : "outline"}
          className="w-full"
          size="sm"
          disabled={resolving}
          onClick={onCreateDraft}
        >
          {resolving ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
          Create Draft Booking
        </Button>
      )}
    </div>
  );
}

export function StaffWalkInPanel({ onBookingResolved, onDcmsResolved }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Awaited<ReturnType<typeof searchWalkIn>> | null>(null);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [vehicleId, setVehicleId] = useState<number | undefined>();
  const [resolvingKey, setResolvingKey] = useState<string | null>(null);
  const [dcmsPending, setDcmsPending] = useState<{ subscriptionId: number; visitType: "cleaning" | "wash" } | null>(null);
  const completeVisit = useCompleteVisit();

  const { data: context, isLoading: loadingContext } = useQuery({
    queryKey: ["walk-in-customer", customerId, vehicleId],
    queryFn: () => fetchWalkInCustomer(customerId!, vehicleId),
    enabled: customerId != null,
  });

  async function handleSearch() {
    if (query.trim().length < 2) return;
    setSearching(true);
    try {
      const results = await searchWalkIn(query.trim());
      setSearchResults(results);
      if (results.customers.length === 0 && results.vehicles.length === 0) {
        toast({ title: "No customer found", description: "Try phone number or vehicle registration", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Search failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSearching(false);
    }
  }

  function pickCustomer(id: number, vId?: number) {
    setCustomerId(id);
    setVehicleId(vId);
    setSearchResults(null);
  }

  function resetCustomer() {
    setCustomerId(null);
    setVehicleId(undefined);
    setSearchResults(null);
  }

  async function handleAction(card: WalkInEntitlementCard, forceDraft: boolean) {
    if (!customerId) return;
    setResolvingKey(card.key);
    try {
      const gps = await getStaffLocation("action");

      const result = await resolveWalkIn({
        customerId,
        serviceKind: card.serviceKind,
        vehicleId: card.vehicleId ?? vehicleId,
        solarSiteId: card.solarSiteId,
        entitlementId: forceDraft ? undefined : card.entitlementId,
        subscriptionId: forceDraft ? undefined : card.subscriptionId,
        legacySubscriptionId: forceDraft ? undefined : card.legacySubscriptionId,
        latitude: gps.latitude,
        longitude: gps.longitude,
        accuracy: gps.accuracy,
        forceDraft,
      });

      qc.invalidateQueries({ queryKey: getGetTodayBookingsQueryKey() });
      qc.invalidateQueries({ queryKey: SERVICE_EXECUTIONS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: ["walk-in-customer", customerId] });

      if (result.mode === "dcms") {
        setDcmsPending({ subscriptionId: result.subscriptionId, visitType: result.visitType });
        toast({ title: "Quota confirmed", description: "Take a photo to complete the visit" });
        onDcmsResolved(result.subscriptionId, result.visitType);
        return;
      }

      toast({
        title: result.createdDraft ? "Draft booking created" : "Service started",
        description: result.message,
      });
      onBookingResolved(result.bookingId);
    } catch (e) {
      toast({ title: forceDraft ? "Draft booking failed" : "Service start failed", description: (e as Error).message, variant: "destructive" });
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
      toast({ title: "Draft booking created", description: result.mode === "booking" ? result.message : "Admin will confirm payment" });
      if (result.mode === "booking") onBookingResolved(result.bookingId);
    } catch (e) {
      toast({ title: "Draft booking failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setResolvingKey(null);
    }
  }

  async function captureDcmsVisit(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !dcmsPending) return;
    e.target.value = "";
    try {
      validateCameraFile(file);
      const [gps, imageBase64, exif] = await Promise.all([
        getStaffLocation("action"),
        readFileAsDataUrl(file),
        extractClientExif(file),
      ]);
      await completeVisit.mutateAsync({
        subscriptionId: dcmsPending.subscriptionId,
        visitType: dcmsPending.visitType,
        imageBase64,
        exif,
        capturedAt: new Date(file.lastModified).toISOString(),
        walkIn: true,
        ...gps,
      });
      toast({ title: "Visit completed", description: "Package quota consumed" });
      setDcmsPending(null);
      resetCustomer();
    } catch (err) {
      toast({ title: "Visit failed", description: (err as Error).message, variant: "destructive" });
    }
  }

  if (dcmsPending) {
    return (
      <section className="rounded-2xl border border-green-500/30 bg-green-500/5 p-4 space-y-3">
        <p className="text-sm font-semibold">Daily clean — photo required</p>
        <p className="text-xs text-muted-foreground">GPS + camera photo completes the visit and consumes package quota</p>
        <label className="flex items-center justify-center gap-2 h-12 rounded-xl border border-primary bg-primary/10 text-sm font-medium cursor-pointer">
          <Camera size={18} /> Take completion photo
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => void captureDcmsVisit(e)} />
        </label>
        <Button type="button" variant="ghost" size="sm" onClick={() => setDcmsPending(null)}>Cancel</Button>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <UserPlus size={18} className="text-primary" />
        <div>
          <p className="font-semibold text-sm">Walk-in entry</p>
          <p className="text-xs text-muted-foreground">Customer dhundho — package dekho — service start karo</p>
        </div>
      </div>

      {!customerId ? (
        <>
          <div className="flex gap-2">
            <Input
              placeholder="Phone ya number plate..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && void handleSearch()}
            />
            <Button type="button" variant="secondary" onClick={() => void handleSearch()} disabled={searching}>
              {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            </Button>
          </div>
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
          <Loader2 size={14} className="animate-spin" /> Loading customer packages…
        </div>
      ) : (
        <>
          <CustomerHeader context={context} onChange={resetCustomer} />

          {context.vehicles.length > 1 && !vehicleId && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Select vehicle</p>
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

          {context.eligibleToday.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Today&apos;s eligible services</p>
              {context.eligibleToday.map(card => (
                <div key={`eligible-${card.key}`} className="flex items-center gap-2 text-sm">
                  {card.recommended ? (
                    <CheckCircle2 size={14} className="text-primary shrink-0" />
                  ) : (
                    <Circle size={14} className="text-muted-foreground shrink-0" />
                  )}
                  <span className={cn(card.recommended && "font-medium")}>
                    {card.recommended ? "Recommended" : "Optional"}: {card.displayName}
                    {card.remaining > 0 && ` (${card.remaining} left)`}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Active packages</p>
            {context.entitlements.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-4 text-center space-y-3">
                <p className="text-sm text-muted-foreground">No active package found</p>
                <Button
                  type="button"
                  className="w-full"
                  disabled={resolvingKey != null}
                  onClick={() => void handleNoPackageDraft()}
                >
                  {resolvingKey === "no-package" ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
                  Create Draft Booking
                </Button>
              </div>
            ) : (
              context.entitlements.map(card => (
                <EntitlementCard
                  key={card.key}
                  card={card}
                  resolving={resolvingKey === card.key}
                  onStartService={() => void handleAction(card, false)}
                  onCreateDraft={() => void handleAction(card, true)}
                />
              ))
            )}
          </div>

          {!context.hasActivePackage && context.entitlements.length > 0 && (
            <div className="rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
              <p className="text-xs text-muted-foreground">No package with remaining quota. Admin will invoice after draft booking.</p>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                size="sm"
                disabled={resolvingKey != null}
                onClick={() => void handleNoPackageDraft()}
              >
                Create Draft Booking (any service)
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
