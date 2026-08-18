import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StaffButton, StaffStatusBadge } from "@/features/staff-ds";
import { Loader2, Plus } from "lucide-react";
import {
  useCreateExtraServiceRequest,
  useStaffExtraServiceContext,
  type ExtraServiceCommercialSource,
  type ExtraServiceContext,
} from "../api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type ExtraAddon = ExtraServiceContext["services"][number]["addons"][number];
type ExtraVehicle = ExtraServiceContext["vehicles"][number];
type ExtraCatalogService = ExtraServiceContext["services"][number];
type Step = "vehicle" | "service" | "addons" | "source" | "review";

export function StaffAddServiceSheet({
  open,
  onOpenChange,
  customerId,
  subscriptionId,
  vehicleId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId?: number;
  subscriptionId?: number;
  vehicleId?: number;
}) {
  const { toast } = useToast();
  const { data, isLoading, isError, error, refetch } = useStaffExtraServiceContext({
    customerId,
    subscriptionId,
    vehicleId,
    enabled: open && (customerId != null || subscriptionId != null),
  });
  const create = useCreateExtraServiceRequest();

  const [step, setStep] = useState<Step>("vehicle");
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(vehicleId ?? null);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [selectedAddonIds, setSelectedAddonIds] = useState<number[]>([]);
  const [source, setSource] = useState<ExtraServiceCommercialSource | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("vehicle");
    setSelectedVehicleId(vehicleId ?? data?.defaultVehicleId ?? null);
    setSelectedServiceId(null);
    setSelectedAddonIds([]);
    setSource(null);
  }, [open, vehicleId, data?.defaultVehicleId]);

  const vehicle = data?.vehicles.find((v: ExtraServiceContext["vehicles"][number]) => v.id === selectedVehicleId) ?? null;
  const service = data?.services.find((s: ExtraServiceContext["services"][number]) => s.id === selectedServiceId) ?? null;
  const dcc = selectedVehicleId != null ? data?.dccByVehicle[selectedVehicleId] : undefined;
  const addons = service?.addons ?? [];

  const amount = useMemo(() => {
    if (!service || !source) return 0;
    const addonTotal = addons.filter((a: ExtraServiceContext["services"][number]["addons"][number]) => selectedAddonIds.includes(a.id)).reduce((sum: number, a: ExtraServiceContext["services"][number]["addons"][number]) => sum + a.price, 0);
    return (source === "DCC_INCLUDED" ? 0 : service.price) + addonTotal;
  }, [service, source, addons, selectedAddonIds]);

  const visibleSteps = useMemo(() => {
    const steps: Step[] = ["vehicle", "service"];
    if (addons.length > 0) steps.push("addons");
    steps.push("source", "review");
    return steps;
  }, [addons.length]);

  function goNext() {
    const idx = visibleSteps.indexOf(step);
    if (idx >= 0 && idx < visibleSteps.length - 1) setStep(visibleSteps[idx + 1]!);
  }
  function goBack() {
    const idx = visibleSteps.indexOf(step);
    if (idx > 0) setStep(visibleSteps[idx - 1]!);
  }

  async function submit() {
    if (!data || !selectedVehicleId || !selectedServiceId || !source) return;
    try {
      await create.mutateAsync({
        customerId: data.customer.id,
        vehicleId: selectedVehicleId,
        serviceId: selectedServiceId,
        addonIds: selectedAddonIds,
        commercialSource: source,
        dcmsSubscriptionId: source === "DCC_INCLUDED" ? dcc?.subscriptionId : null,
      });
      toast({ title: "Sent for customer approval" });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Could not send request",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
    }
  }

  const canNext =
    (step === "vehicle" && selectedVehicleId != null)
    || (step === "service" && selectedServiceId != null)
    || step === "addons"
    || (step === "source" && source != null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[90dvh] overflow-y-auto rounded-t-2xl"
        data-testid="staff-add-service-sheet"
      >
        <SheetHeader>
          <SheetTitle>Add Service</SheetTitle>
          <SheetDescription>
            Extra car wash — customer must approve. This is not daily cleaning.
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading
          </div>
        ) : isError ? (
          <div className="space-y-3 py-6">
            <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Could not load"}</p>
            <StaffButton variant="outline" onClick={() => refetch()}>Retry</StaffButton>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <p className="text-xs text-muted-foreground">
              {data?.customer.name} · step {visibleSteps.indexOf(step) + 1} of {visibleSteps.length}
            </p>

            {step === "vehicle" && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Which vehicle?</p>
                {data?.vehicles.map((v: ExtraVehicle) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVehicleId(v.id)}
                    className={cn(
                      "w-full rounded-xl border p-3 text-left text-sm",
                      selectedVehicleId === v.id ? "border-primary bg-primary/5" : "border-border",
                    )}
                  >
                    <span className="font-medium">{v.label}</span>
                  </button>
                ))}
              </div>
            )}

            {step === "service" && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Car Wash</p>
                {data?.services.length === 0 && (
                  <p className="text-sm text-muted-foreground">No car wash services in the catalog.</p>
                )}
                {data?.services.map((s: ExtraCatalogService) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setSelectedServiceId(s.id); setSelectedAddonIds([]); }}
                    className={cn(
                      "w-full rounded-xl border p-3 text-left text-sm",
                      selectedServiceId === s.id ? "border-primary bg-primary/5" : "border-border",
                    )}
                  >
                    <span className="font-medium">{s.name}</span>
                    <span className="float-right tabular-nums">₹{Math.round(s.price)}</span>
                  </button>
                ))}
              </div>
            )}

            {step === "addons" && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Addons (optional)</p>
                {addons.map((a: ExtraAddon) => {
                  const on = selectedAddonIds.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setSelectedAddonIds(ids => on ? ids.filter(id => id !== a.id) : [...ids, a.id])}
                      className={cn(
                        "w-full rounded-xl border p-3 text-left text-sm",
                        on ? "border-primary bg-primary/5" : "border-border",
                      )}
                    >
                      <span className="font-medium">{a.name}</span>
                      <span className="float-right tabular-nums">₹{Math.round(a.price)}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {step === "source" && (
              <div className="space-y-2">
                <p className="text-sm font-medium">How should this be billed?</p>
                <button
                  type="button"
                  disabled={!dcc}
                  onClick={() => dcc && setSource("DCC_INCLUDED")}
                  className={cn(
                    "w-full rounded-xl border p-3 text-left text-sm disabled:opacity-50",
                    source === "DCC_INCLUDED" ? "border-primary bg-primary/5" : "border-border",
                  )}
                >
                  <p className="font-medium">Use available DCC included wash</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {dcc
                      ? `${dcc.remainingWashes} included wash left on ${dcc.planName}`
                      : "No included wash left on this vehicle"}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setSource("PAID_EXTRA")}
                  className={cn(
                    "w-full rounded-xl border p-3 text-left text-sm",
                    source === "PAID_EXTRA" ? "border-primary bg-primary/5" : "border-border",
                  )}
                >
                  <p className="font-medium">Paid extra wash</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Customer approves the catalog price. Payment follows the existing invoice flow after the wash.
                  </p>
                </button>
              </div>
            )}

            {step === "review" && vehicle && service && source && (
              <div className="space-y-3 rounded-xl border border-border p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vehicle</span>
                  <span className="font-medium">{vehicle.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service</span>
                  <span className="font-medium">{service.name}</span>
                </div>
                {selectedAddonIds.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Addons</span>
                    <span className="font-medium">{addons.filter((a: ExtraAddon) => selectedAddonIds.includes(a.id)).map((a: ExtraAddon) => a.name).join(", ")}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Source</span>
                  <span className="font-medium">
                    {source === "DCC_INCLUDED" ? "Use 1 included wash" : "Paid extra"}
                  </span>
                </div>
                <div className="flex justify-between text-base">
                  <span className="font-medium">Customer will see</span>
                  <span className="font-bold tabular-nums">
                    {source === "DCC_INCLUDED" && amount <= 0 ? "₹0" : `₹${Math.round(amount)}`}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Approval does not finish the wash or consume a credit. That happens when you complete the car wash job.
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              {step !== visibleSteps[0] && (
                <StaffButton variant="outline" className="flex-1" onClick={goBack}>Back</StaffButton>
              )}
              {step !== "review" ? (
                <StaffButton className="flex-1" disabled={!canNext} onClick={goNext}>Next</StaffButton>
              ) : (
                <StaffButton
                  className="flex-1"
                  disabled={create.isPending}
                  onClick={() => void submit()}
                >
                  {create.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Request customer approval
                </StaffButton>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function StaffAddServiceButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <StaffButton
      type="button"
      variant="outline"
      className="w-full h-12"
      onClick={onClick}
      disabled={disabled}
      data-testid="staff-add-service"
    >
      <Plus className="h-4 w-4 mr-2" />
      Add Service
    </StaffButton>
  );
}

export function ExtraServiceStatusCard({
  request,
  otp,
  onOtpChange,
  onVerify,
  verifying,
  error,
}: {
  request: {
    id: number;
    status: string;
    serviceName: string;
    vehicleLabel: string;
    amountDisplay: string;
    entitlementLabel: string | null;
    otpExpired: boolean;
    executionId: number | null;
  };
  otp: string;
  onOtpChange: (value: string) => void;
  onVerify: () => void;
  verifying?: boolean;
  error?: string | null;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3" data-testid="extra-service-status">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Extra service</p>
        <StaffStatusBadge status={request.status} />
      </div>
      <p className="text-sm">
        {request.vehicleLabel} · {request.serviceName}
      </p>
      <p className="text-sm text-muted-foreground">
        {request.entitlementLabel ?? request.amountDisplay}
      </p>
      {request.status === "pending_customer_approval" && (
        <p className="text-sm font-medium">Waiting for customer approval</p>
      )}
      {request.status === "customer_approved" && (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            {request.otpExpired ? "Code expired — ask customer to approve again" : "Customer approved — enter OTP"}
          </p>
          {!request.otpExpired && (
            <>
              <input
                inputMode="numeric"
                maxLength={4}
                value={otp}
                onChange={e => onOtpChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="w-full h-12 rounded-xl border border-border bg-background px-3 text-center text-2xl tracking-[0.4em] font-semibold"
                placeholder="••••"
                aria-label="Customer verification code"
                data-testid="extra-service-otp-input"
              />
              {error ? <p className="text-xs text-destructive">{error}</p> : null}
              <StaffButton
                className="w-full"
                disabled={otp.length !== 4 || verifying}
                onClick={onVerify}
              >
                {verifying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Verify code
              </StaffButton>
            </>
          )}
        </div>
      )}
      {request.status === "otp_verified" && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-green-700">Service added</p>
          {request.executionId ? (
            <StaffButton href={`/staff/bookings?job=execution-${request.executionId}`} className="w-full">
              Open wash job
            </StaffButton>
          ) : null}
        </div>
      )}
    </div>
  );
}
