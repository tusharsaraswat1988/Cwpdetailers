import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccountScope } from "@/lib/account-scope";
import { useListVehicles, getListVehiclesQueryKey } from "@workspace/api-client-react";
import { useSocieties, useSocietyTowers } from "@/features/societies/api";
import { launchCashfreeCheckout } from "@/lib/cashfree";
import { launchRazorpayCheckout } from "@/lib/razorpay";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Car, Building2, ShieldCheck, Check, AlertCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

type AvailablePlan = {
  id: number;
  name: string;
  description?: string | null;
  price: string;
  includedCleanings: number;
  includedWashes: number;
  weeklyOffs: number;
};

interface CustomerSubscribeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultVehicleId?: number;
}

export function CustomerSubscribeModal({
  open,
  onOpenChange,
  defaultVehicleId,
}: CustomerSubscribeModalProps) {
  const { customerId, cityId: scopeCityId } = useAccountScope();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(
    defaultVehicleId ? String(defaultVehicleId) : "",
  );
  const [selectedCityId, setSelectedCityId] = useState<string>(
    scopeCityId ? String(scopeCityId) : "1",
  );
  const [selectedSocietyId, setSelectedSocietyId] = useState<string>("");
  const [selectedTowerId, setSelectedTowerId] = useState<string>("");
  const [flatNumber, setFlatNumber] = useState<string>("");
  const [parkingBay, setParkingBay] = useState<string>("");
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);

  const [plans, setPlans] = useState<AvailablePlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch customer vehicles
  const { data: rawVehicles } = useListVehicles(
    { customerId: customerId ?? 0 },
    {
      query: {
        queryKey: getListVehiclesQueryKey({ customerId: customerId ?? 0 }),
        enabled: customerId != null && open,
      },
    },
  );
  const vehicles = (rawVehicles ?? []) as Array<{
    id: number;
    registrationNumber: string;
    model?: string;
    brand?: string;
    cityId?: number;
  }>;

  // Set default vehicle when vehicles load
  useEffect(() => {
    if (vehicles.length > 0 && !selectedVehicleId) {
      setSelectedVehicleId(String(vehicles[0].id));
      if (vehicles[0].cityId) {
        setSelectedCityId(String(vehicles[0].cityId));
      }
    }
  }, [vehicles, selectedVehicleId]);

  // Fetch societies for the chosen city
  const { data: societiesData } = useSocieties(
    selectedCityId ? { cityId: Number(selectedCityId), limit: 100 } : undefined,
  );
  const societies = societiesData?.data ?? [];

  // Fetch towers for selected society
  const { data: towersData } = useSocietyTowers(
    selectedSocietyId ? Number(selectedSocietyId) : 0,
  );
  const towers = towersData?.data ?? [];

  // Fetch plans whenever vehicleId or cityId changes
  useEffect(() => {
    if (!open) return;
    let isCancelled = false;
    async function fetchPlans() {
      setLoadingPlans(true);
      try {
        const queryParams = new URLSearchParams();
        if (selectedVehicleId) queryParams.set("vehicleId", selectedVehicleId);
        if (selectedCityId) queryParams.set("cityId", selectedCityId);

        const res = await fetch(`/api/daily-cleaning/customer/available-plans?${queryParams}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to load plans");
        const data = await res.json();
        if (!isCancelled) {
          setPlans(data.plans ?? []);
          if (data.plans?.length > 0 && !selectedPlanId) {
            setSelectedPlanId(data.plans[0].id);
          }
        }
      } catch (err) {
        console.warn("[CustomerSubscribeModal] Plan fetch error:", err);
      } finally {
        if (!isCancelled) setLoadingPlans(false);
      }
    }
    fetchPlans();
    return () => {
      isCancelled = true;
    };
  }, [open, selectedVehicleId, selectedCityId]);

  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const basePrice = selectedPlan ? Number(selectedPlan.price) : 0;
  const gstAmount = Math.round(basePrice * 0.18);
  const totalAmount = basePrice + gstAmount;

  const handleSubscribeAndPay = async () => {
    if (!selectedPlanId || !selectedVehicleId) {
      toast({
        title: "Missing Details",
        description: "Please select a vehicle and a daily cleaning plan.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/daily-cleaning/customer/subscribe-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          planId: selectedPlanId,
          vehicleId: Number(selectedVehicleId),
          cityId: selectedCityId ? Number(selectedCityId) : undefined,
          societyId: selectedSocietyId ? Number(selectedSocietyId) : undefined,
          towerId: selectedTowerId ? Number(selectedTowerId) : undefined,
          flatNumber: flatNumber.trim() || undefined,
          parkingBay: parkingBay.trim() || undefined,
          returnUrl: `/customer/payment/return?order_id={order_id}`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to initialize subscription checkout.");
      }

      if (data.gateway === "razorpay") {
        toast({
          title: "Subscription Initiated",
          description: "Opening secure Razorpay payment window...",
        });

        const rzpResponse = await launchRazorpayCheckout({
          keyId: data.keyId,
          orderId: data.orderId,
          amountInPaise: data.amountInPaise,
          name: "CWP Detailers",
          description: "Daily Car Cleaning Subscription",
          correlationId: data.correlationId,
          prefill: {
            name: data.customer?.name || "",
            contact: data.customer?.phone || "",
            email: data.customer?.email || "",
          },
        });

        // Verify payment atomically on backend
        const verifyRes = await fetch("/api/payments/razorpay/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-correlation-id": data.correlationId,
          },
          credentials: "include",
          body: JSON.stringify({
            orderId: rzpResponse.razorpay_order_id,
            paymentId: rzpResponse.razorpay_payment_id,
            signature: rzpResponse.razorpay_signature,
            correlationId: data.correlationId,
          }),
        });

        const verifyData = await verifyRes.json();
        if (verifyRes.ok && verifyData.success) {
          toast({
            title: "Subscription Activated!",
            description: "Your daily car cleaning subscription is now active.",
          });
          queryClient.invalidateQueries({ queryKey: ["dcms"] });
          onOpenChange(false);
        } else {
          throw new Error(verifyData.message || "Payment verification failed");
        }
      } else if (data.paymentSessionId) {
        toast({
          title: "Subscription Initiated",
          description: "Redirecting to secure Cashfree payment gateway...",
        });
        queryClient.invalidateQueries({ queryKey: ["dcms"] });
        onOpenChange(false);
        await launchCashfreeCheckout({
          paymentSessionId: data.paymentSessionId,
          environment: data.environment || "sandbox",
          redirectTarget: "_self",
        });
      }
    } catch (err: any) {
      const isDismissed =
        err.isDismissal === true ||
        err.code === "USER_DROPPED" ||
        err.message?.includes("closed by the user") ||
        err.message?.includes("dismissed") ||
        err.message?.includes("cancelled");

      if (isDismissed) {
        toast({
          title: "Subscription Setup Paused",
          description: "Payment window was closed. You can complete your subscription at any time.",
        });
      } else {
        toast({
          title: "Online Checkout Notice",
          description: "Online checkout is momentarily unavailable. Our team has been alerted.",
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto p-0 rounded-2xl border border-slate-200 shadow-xl bg-white">
        <div className="bg-[#0B1D36] text-white p-6 pb-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary-200">
            <Sparkles size={16} className="text-yellow-400" /> Doorstep Vehicle Care
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-bold font-display text-white mt-1">
            Subscribe to Daily Car Cleaning
          </DialogTitle>
          <DialogDescription className="text-slate-300 text-xs sm:text-sm mt-1">
            Get your car dusted and wiped daily right at your society parking bay with periodic foam washes.
          </DialogDescription>
        </div>

        <div className="p-6 space-y-5">
          {/* Step 1: Vehicle Selection */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Car size={14} className="text-primary" /> 1. Select Vehicle
            </Label>
            {vehicles.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                No vehicles registered. Please add a vehicle first under Assets to subscribe.
              </div>
            ) : (
              <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Choose your car" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map(v => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      {v.registrationNumber} {v.brand || v.model ? `(${v.brand ?? ""} ${v.model ?? ""})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Step 2: Society and Parking Details */}
          <div className="space-y-3 pt-1 border-t border-slate-100">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Building2 size={14} className="text-primary" /> 2. Society & Parking Location
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="society-select" className="text-[11px] text-muted-foreground font-medium">
                  Residential Society
                </Label>
                <Select
                  value={selectedSocietyId}
                  onValueChange={v => {
                    setSelectedSocietyId(v);
                    setSelectedTowerId("");
                  }}
                >
                  <SelectTrigger id="society-select" className="h-10 rounded-xl mt-1 text-xs">
                    <SelectValue placeholder="Select Society" />
                  </SelectTrigger>
                  <SelectContent>
                    {societies.map(s => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="tower-select" className="text-[11px] text-muted-foreground font-medium">
                  Tower / Wing
                </Label>
                <Select
                  value={selectedTowerId}
                  onValueChange={setSelectedTowerId}
                  disabled={!selectedSocietyId || towers.length === 0}
                >
                  <SelectTrigger id="tower-select" className="h-10 rounded-xl mt-1 text-xs">
                    <SelectValue placeholder={towers.length === 0 ? "No towers listed" : "Select Tower"} />
                  </SelectTrigger>
                  <SelectContent>
                    {towers.map(t => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="flat-num" className="text-[11px] text-muted-foreground font-medium">
                  Flat / Unit Number
                </Label>
                <Input
                  id="flat-num"
                  placeholder="e.g. Tower 3, Flat 1204"
                  value={flatNumber}
                  onChange={e => setFlatNumber(e.target.value)}
                  className="h-10 text-xs rounded-xl mt-1"
                />
              </div>
              <div>
                <Label htmlFor="parking-bay" className="text-[11px] text-muted-foreground font-medium">
                  Parking Bay / Basement Level
                </Label>
                <Input
                  id="parking-bay"
                  placeholder="e.g. B2 - Bay 44"
                  value={parkingBay}
                  onChange={e => setParkingBay(e.target.value)}
                  className="h-10 text-xs rounded-xl mt-1"
                />
              </div>
            </div>
          </div>

          {/* Step 3: Plan Selection */}
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Sparkles size={14} className="text-primary" /> 3. Choose Plan
            </Label>
            {loadingPlans ? (
              <div className="p-4 text-center text-xs text-muted-foreground">Loading available plans...</div>
            ) : plans.length === 0 ? (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-muted-foreground">
                No active plans found for this vehicle/city combination.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {plans.map(p => {
                  const isSelected = p.id === selectedPlanId;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPlanId(p.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? "border-primary bg-blue-50/60 shadow-xs ring-1 ring-primary/40"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">{p.name}</span>
                          {isSelected && (
                            <span className="text-[10px] bg-primary text-white font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                              <Check size={10} /> Selected
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {p.includedCleanings} Daily Cleanings · {p.includedWashes} Foam Washes
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-display font-bold text-base text-foreground">₹{p.price}</span>
                        <span className="text-[11px] text-muted-foreground block">/month</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Payment & Integrity Notice */}
          {selectedPlan && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-2 text-xs">
              <div className="flex justify-between font-medium text-slate-600">
                <span>Monthly Subscription</span>
                <span>₹{basePrice.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between font-medium text-slate-600">
                <span>GST (18%)</span>
                <span>₹{gstAmount.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 border-t border-blue-200 pt-2 text-sm">
                <span>Total Payable</span>
                <span className="text-primary font-display">₹{totalAmount.toLocaleString("en-IN")}</span>
              </div>

              <div className="pt-2 flex items-start gap-2 text-[11px] text-slate-500">
                <ShieldCheck size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Payment Integrity Guarantee:</strong> Your subscription is created in <em>Pending Payment</em> status. Cleaner staff routes are enqueued strictly upon verified payment.
                </span>
              </div>
            </div>
          )}

          <Button
            onClick={handleSubscribeAndPay}
            disabled={isSubmitting || !selectedPlanId || !selectedVehicleId}
            className="w-full h-12 rounded-xl bg-primary hover:bg-[#1264db] text-white font-semibold text-sm shadow-sm cursor-pointer"
          >
            {isSubmitting ? (
              "Processing Checkout..."
            ) : (
              `Proceed to Payment · ₹${totalAmount.toLocaleString("en-IN")}`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
