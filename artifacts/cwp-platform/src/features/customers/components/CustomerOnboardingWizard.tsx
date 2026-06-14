import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { CheckCircle, ChevronRight, UserPlus } from "lucide-react";
import { QuickCreateCustomerForm } from "./QuickCreateCustomerForm";
import { VehicleModelSelect } from "@/components/shared/VehicleModelSelect";
import { LocationPicker } from "@/components/shared/LocationPicker";
import { CustomerPhotoEditor } from "@/components/shared/CustomerPhotoEditor";
import type { LocationValue, VehicleModel } from "@/features/master-data/api";
import { useCreateVehicle } from "@workspace/api-client-react";
import { creditCustomerWallet, type CreateCustomerResult } from "../api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  basePath?: string;
};

type Step = "customer" | "photo" | "vehicle" | "wallet" | "done";

export function CustomerOnboardingWizard({ open, onOpenChange, basePath = "/admin/customers" }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("customer");
  const [customer, setCustomer] = useState<CreateCustomerResult | null>(null);
  const [selectedModel, setSelectedModel] = useState<VehicleModel | null>(null);
  const [vehicleForm, setVehicleForm] = useState({ year: "", color: "", registrationNumber: "" });
  const [vehicleLocation, setVehicleLocation] = useState<LocationValue | null>(null);
  const [walletAmount, setWalletAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("upi");
  const [walletNotes, setWalletNotes] = useState("");
  const [vehicleSkipped, setVehicleSkipped] = useState(false);

  const createVehicle = useCreateVehicle();

  const reset = () => {
    setStep("customer");
    setCustomer(null);
    setSelectedModel(null);
    setVehicleForm({ year: "", color: "", registrationNumber: "" });
    setVehicleLocation(null);
    setWalletAmount("");
    setPaymentMode("upi");
    setWalletNotes("");
    setVehicleSkipped(false);
  };

  const close = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleVehicleStep = async (skip: boolean) => {
    if (skip || !customer) {
      setVehicleSkipped(skip);
      setStep("wallet");
      return;
    }
    if (!selectedModel || !vehicleForm.registrationNumber.trim()) {
      toast({ title: "Select model and registration", variant: "destructive" });
      return;
    }
    try {
      await createVehicle.mutateAsync({
        data: {
          customerId: customer.id,
          vehicleModelId: selectedModel.id,
          make: selectedModel.brandName,
          model: selectedModel.name,
          year: vehicleForm.year ? parseInt(vehicleForm.year, 10) : undefined,
          color: vehicleForm.color || undefined,
          registrationNumber: vehicleForm.registrationNumber.trim().toUpperCase(),
          ...(vehicleLocation ? {
            serviceAddress: vehicleLocation.address,
            serviceLat: vehicleLocation.latitude,
            serviceLng: vehicleLocation.longitude,
            placeId: vehicleLocation.placeId,
            locationLabel: "Default Service Location",
          } : {}),
        } as any,
      });
      setVehicleSkipped(false);
      setStep("wallet");
      toast({ title: "Vehicle added" });
    } catch (err: any) {
      toast({ title: "Vehicle failed", description: err?.response?.data?.error ?? err.message, variant: "destructive" });
    }
  };

  const handleWalletStep = async (skip: boolean) => {
    if (!customer) return;
    if (skip || !walletAmount || parseFloat(walletAmount) <= 0) {
      setStep("done");
      return;
    }
    try {
      await creditCustomerWallet(customer.id, {
        amount: parseFloat(walletAmount),
        paymentMode,
        notes: walletNotes || undefined,
      });
      setStep("done");
      toast({ title: "Wallet credited" });
    } catch (err) {
      toast({
        title: "Wallet credit failed",
        description: err instanceof Error ? err.message : "Error",
        variant: "destructive",
      });
    }
  };

  const stepTitle: Record<Step, string> = {
    customer: "Step 1 — Customer",
    photo: "Step 2 — Profile photo",
    vehicle: "Step 3 — Vehicle",
    wallet: "Step 4 — Wallet",
    done: "Onboarding complete",
  };

  const isAdminPortal = basePath.startsWith("/admin");

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus size={18} className="text-primary" />
            {stepTitle[step]}
          </DialogTitle>
        </DialogHeader>

        {step === "customer" && (
          <QuickCreateCustomerForm
            idPrefix="onboard-customer"
            customerBasePath={basePath}
            showBillingFields
            submitLabel="Next: Add photo"
            onCreated={c => {
              setCustomer(c);
              setStep("photo");
            }}
          />
        )}

        {step === "photo" && customer && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Optional profile photo for <strong>{customer.name}</strong>.
            </p>
            <CustomerPhotoEditor
              customerId={customer.id}
              name={customer.name}
              size="lg"
              testIdPrefix="onboard-customer-photo"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("vehicle")}>
                Skip
              </Button>
              <Button className="flex-1 bg-primary text-secondary" onClick={() => setStep("vehicle")}>
                Next: Vehicle <ChevronRight size={14} className="ml-1" />
              </Button>
            </div>
          </div>
        )}

        {step === "vehicle" && customer && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Customer <strong>{customer.name}</strong> created. Add their vehicle or skip.
            </p>
            <VehicleModelSelect modelId={selectedModel?.id} onSelect={setSelectedModel} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Year</Label>
                <Input className="mt-1" type="number" value={vehicleForm.year} onChange={e => setVehicleForm(f => ({ ...f, year: e.target.value }))} />
              </div>
              <div>
                <Label>Color</Label>
                <Input className="mt-1" value={vehicleForm.color} onChange={e => setVehicleForm(f => ({ ...f, color: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Registration</Label>
              <Input
                className="mt-1"
                value={vehicleForm.registrationNumber}
                onChange={e => setVehicleForm(f => ({ ...f, registrationNumber: e.target.value.toUpperCase() }))}
              />
            </div>
            <LocationPicker value={vehicleLocation} onChange={loc => setVehicleLocation(loc)} />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => void handleVehicleStep(true)}>
                Skip
              </Button>
              <Button
                className="flex-1 bg-primary text-secondary"
                disabled={createVehicle.isPending}
                onClick={() => void handleVehicleStep(false)}
              >
                {createVehicle.isPending ? "Saving..." : "Next: Wallet"}
                <ChevronRight size={14} className="ml-1" />
              </Button>
            </div>
          </div>
        )}

        {step === "wallet" && customer && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {vehicleSkipped ? "No vehicle added." : "Vehicle saved."} Add opening wallet credit or skip.
            </p>
            <div>
              <Label>Amount (₹)</Label>
              <Input type="number" min="1" className="mt-1" value={walletAmount} onChange={e => setWalletAmount(e.target.value)} />
            </div>
            <div>
              <Label>Payment mode</Label>
              <Select value={paymentMode} onValueChange={setPaymentMode}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Remarks</Label>
              <Input className="mt-1" value={walletNotes} onChange={e => setWalletNotes(e.target.value)} placeholder="Optional" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => void handleWalletStep(true)}>Skip</Button>
              <Button className="flex-1 bg-primary text-secondary" onClick={() => void handleWalletStep(false)}>
                Finish <CheckCircle size={14} className="ml-1" />
              </Button>
            </div>
          </div>
        )}

        {step === "done" && customer && (
          <div className="space-y-4 text-center py-2">
            <CheckCircle size={40} className="mx-auto text-green-500" />
            <p className="font-medium">{customer.name} is ready for operations.</p>
            <div className="flex flex-col gap-2">
              <Link href={`${basePath}/${customer.id}`}>
                <Button className="w-full bg-primary text-secondary" onClick={() => close(false)}>
                  Open customer profile
                </Button>
              </Link>
              {isAdminPortal && (
                <Link href="/admin/daily-cleaning/subscriptions">
                  <Button variant="outline" className="w-full" onClick={() => close(false)} data-testid="btn-onboard-dcms">
                    Create daily-cleaning plan
                  </Button>
                </Link>
              )}
              <Button variant="ghost" onClick={() => close(false)}>Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
