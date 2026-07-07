import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, UserPlus, Loader2, Camera } from "lucide-react";
import {
  searchWalkIn,
  fetchWalkInQuota,
  resolveWalkIn,
  type WalkInServiceKind,
  type WalkInQuotaOption,
} from "@/features/staff-walk-in/api";
import { useCompleteVisit } from "@/features/daily-cleaning/api";
import { getStaffLocation } from "@/lib/location";
import { validateCameraFile, readFileAsDataUrl, extractClientExif } from "@/features/daily-cleaning/lib/cameraCapture";
import { SERVICE_EXECUTIONS_QUERY_KEY } from "@/features/service-executions/api";
import { getGetTodayBookingsQueryKey } from "@workspace/api-client-react";

const SERVICE_KINDS: { value: WalkInServiceKind; label: string }[] = [
  { value: "car_wash", label: "Car wash" },
  { value: "solar_clean", label: "Solar clean" },
  { value: "daily_clean", label: "Daily clean" },
  { value: "daily_wash", label: "Daily wash" },
];

type Props = {
  onBookingResolved: (bookingId: number) => void;
  onDcmsResolved: (subscriptionId: number, visitType: "cleaning" | "wash") => void;
};

export function StaffWalkInPanel({ onBookingResolved, onDcmsResolved }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Awaited<ReturnType<typeof searchWalkIn>> | null>(null);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [serviceKind, setServiceKind] = useState<WalkInServiceKind>("car_wash");
  const [vehicleId, setVehicleId] = useState<number | undefined>();
  const [selectedQuota, setSelectedQuota] = useState<WalkInQuotaOption | null>(null);
  const [resolving, setResolving] = useState(false);
  const [dcmsPending, setDcmsPending] = useState<{ subscriptionId: number; visitType: "cleaning" | "wash" } | null>(null);
  const completeVisit = useCompleteVisit();

  const { data: quotaData, isLoading: loadingQuota } = useQuery({
    queryKey: ["walk-in-quota", customerId, serviceKind, vehicleId],
    queryFn: () => fetchWalkInQuota(customerId!, serviceKind, vehicleId),
    enabled: customerId != null,
  });

  async function handleSearch() {
    if (query.trim().length < 2) return;
    setSearching(true);
    try {
      const results = await searchWalkIn(query.trim());
      setSearchResults(results);
      if (results.customers.length === 0 && results.vehicles.length === 0) {
        toast({ title: "No customer found", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Search failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSearching(false);
    }
  }

  function pickCustomer(id: number, name: string, vId?: number) {
    setCustomerId(id);
    setCustomerName(name);
    setVehicleId(vId);
    setSelectedQuota(null);
    setSearchResults(null);
  }

  async function handleResolve() {
    if (!customerId) return;
    const quota = selectedQuota ?? options.find(o => o.source !== "none") ?? options[0];
    if (!quota) return;
    setResolving(true);
    try {
      const gps = await getStaffLocation("action");

      const result = await resolveWalkIn({
        customerId,
        serviceKind,
        vehicleId: quota?.vehicleId ?? vehicleId,
        subscriptionId: quota?.subscriptionId,
        entitlementId: quota?.entitlementId,
        legacySubscriptionId: quota?.legacySubscriptionId,
        latitude: gps.latitude,
        longitude: gps.longitude,
      });

      qc.invalidateQueries({ queryKey: getGetTodayBookingsQueryKey() });
      qc.invalidateQueries({ queryKey: SERVICE_EXECUTIONS_QUERY_KEY });

      if (result.mode === "dcms") {
        setDcmsPending({ subscriptionId: result.subscriptionId, visitType: result.visitType });
        toast({ title: "Quota OK", description: "Ab photo leke visit complete karein" });
        onDcmsResolved(result.subscriptionId, result.visitType);
        return;
      }

      toast({
        title: result.createdDraft ? "Draft booking created" : "Booking ready",
        description: result.message,
        variant: result.createdDraft ? "default" : undefined,
      });
      onBookingResolved(result.bookingId);
    } catch (e) {
      toast({ title: "Entry failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setResolving(false);
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
        walkIn: true,
        ...gps,
      });
      toast({ title: "Visit completed", description: "Quota se cut ho gaya" });
      setDcmsPending(null);
      setCustomerId(null);
    } catch (err) {
      toast({ title: "Visit failed", description: (err as Error).message, variant: "destructive" });
    }
  }

  const options = quotaData?.options ?? [];

  if (dcmsPending) {
    return (
      <section className="rounded-2xl border border-green-500/30 bg-green-500/5 p-4 space-y-3">
        <p className="text-sm font-semibold">Walk-in daily clean — photo required</p>
        <p className="text-xs text-muted-foreground">GPS + camera photo se visit complete hoga, package se visit cut hogi</p>
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
          <p className="text-xs text-muted-foreground">Assign nahi hua? Customer dhundho, quota check karo, entry karo</p>
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
                  onClick={() => pickCustomer(c.id, c.name)}
                >
                  {c.label}
                </button>
              ))}
              {searchResults.vehicles.map(v => (
                <button
                  key={v.id}
                  type="button"
                  className="w-full text-left rounded-lg border border-border bg-card px-3 py-2 text-sm hover:border-primary/40"
                  onClick={() => pickCustomer(v.customerId, v.label, v.id)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">{customerName}</p>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setCustomerId(null); setSelectedQuota(null); }}>
              Change
            </Button>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Service type</Label>
            <div className="flex flex-wrap gap-1.5">
              {SERVICE_KINDS.map(k => (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => { setServiceKind(k.value); setSelectedQuota(null); }}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    serviceKind === k.value ? "bg-primary text-primary-foreground border-primary" : "border-border"
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          {loadingQuota ? (
            <p className="text-xs text-muted-foreground">Checking quota…</p>
          ) : (
            <div className="space-y-2">
              <Label className="text-xs">Package / quota</Label>
              {options.map((opt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedQuota(opt)}
                  className={`w-full text-left rounded-lg border px-3 py-2 text-xs ${
                    selectedQuota === opt ? "border-primary bg-primary/10" : "border-border bg-card"
                  }`}
                >
                  <span>{opt.label}</span>
                  {opt.source === "none" && <Badge variant="outline" className="ml-2 text-[10px]">Draft</Badge>}
                </button>
              ))}
            </div>
          )}

          <Button
            type="button"
            className="w-full"
            disabled={resolving || loadingQuota || options.length === 0}
            onClick={() => void handleResolve()}
          >
            {resolving ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
            Start entry
          </Button>
        </>
      )}
    </section>
  );
}
