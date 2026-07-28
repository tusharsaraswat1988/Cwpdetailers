import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useListBranches, getListBranchesQueryKey, type Branch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhoneInput } from "@/components/ui/phone-input";
import { EmailInput } from "@/components/ui/email-input";
import { submitEmail, submitMobile } from "@/lib/contactForm";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useAppStore } from "@/lib/store";
import { isGoogleMapsConfigured } from "@/lib/maps";
import { ExternalLink } from "lucide-react";
import {
  CustomerServiceAddressSection,
  composeSavedAddress,
} from "./CustomerServiceAddressSection";
import { createCustomerRequest, type CreateCustomerResult } from "../api";

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export type QuickCreateCustomerDialogProps = {
  onCreated: (customer: CreateCustomerResult) => void;
  onDuplicate?: (existing: { id: number; name?: string }) => void;
  /** Base path for "Open existing customer" on duplicate phone, e.g. /admin/customers */
  customerBasePath?: string;
  submitLabel?: string;
  idPrefix?: string;
  showBillingFields?: boolean;
};

function filterBranchOptions(
  branches: Branch[] | undefined,
  scopeBranchIds: number[] | null,
): Branch[] {
  let list = (branches ?? []).filter(b => b.isActive !== false);
  if (scopeBranchIds !== null) {
    list = list.filter(b => scopeBranchIds.includes(b.id));
  }
  return list;
}

function resolveDefaultBranchId(
  options: Branch[],
  userBranchId: number | null | undefined,
  activeBranchId: number | null,
  scopeBranchIds: number[] | null,
): string {
  const pick = (id: number | null | undefined) =>
    id != null && options.some(b => b.id === id) ? String(id) : null;

  return (
    pick(userBranchId)
    ?? pick(activeBranchId)
    ?? (scopeBranchIds?.length === 1 ? pick(scopeBranchIds[0]) : null)
    ?? (options.length === 1 ? String(options[0].id) : "")
    ?? ""
  );
}

function emptyForm(branchId = "") {
  return {
    name: "",
    phone: "",
    email: "",
    city: "",
    houseNumber: "",
    buildingName: "",
    area: "",
    landmark: "",
    pincode: "",
    serviceLocationLabel: "Home",
    latitude: "",
    longitude: "",
    placeId: "",
    branchId,
    createLogin: true,
    password: "",
    gstin: "",
    billingName: "",
  };
}

export function QuickCreateCustomerForm({
  onCreated,
  onDuplicate,
  customerBasePath = "/admin/customers",
  submitLabel = "Create Customer",
  idPrefix = "quick-customer",
  showBillingFields = false,
}: QuickCreateCustomerDialogProps) {
  const { toast } = useToast();
  const { user, scope } = useAuth();
  const activeBranchId = useAppStore(s => s.activeBranchId);
  const [form, setForm] = useState(emptyForm());
  const [errors, setErrors] = useState<{ phone?: string | null; email?: string | null }>({});
  const [creating, setCreating] = useState(false);
  const [duplicateExisting, setDuplicateExisting] = useState<{ id: number; name?: string } | null>(null);
  const [showB2BBilling, setShowB2BBilling] = useState(false);
  const { data: branches } = useListBranches({ query: { queryKey: getListBranchesQueryKey() } });

  const branchOptions = useMemo(
    () => filterBranchOptions(branches, scope?.branchIds ?? null),
    [branches, scope?.branchIds],
  );

  const defaultBranchId = useMemo(
    () => resolveDefaultBranchId(branchOptions, user?.branchId, activeBranchId, scope?.branchIds ?? null),
    [branchOptions, user?.branchId, activeBranchId, scope?.branchIds],
  );

  const selectedBranch = branchOptions.find(b => String(b.id) === form.branchId);
  const mapsEnabled = isGoogleMapsConfigured();
  const savedAddress = composeSavedAddress({
    houseNumber: form.houseNumber,
    buildingName: form.buildingName,
    area: form.area,
    landmark: form.landmark,
    pincode: form.pincode,
    city: form.city,
  });

  useEffect(() => {
    if (!defaultBranchId) return;
    setForm(f => (f.branchId ? f : { ...f, branchId: defaultBranchId }));
  }, [defaultBranchId]);

  const branchCity = selectedBranch?.city
    ?? branchOptions.find(b => String(b.id) === defaultBranchId)?.city;

  useEffect(() => {
    if (!branchCity) return;
    setForm(f => (f.city.trim() ? f : { ...f, city: branchCity }));
  }, [branchCity]);

  const handleSubmit = async () => {
    const phoneResult = submitMobile(form.phone);
    const emailResult = submitEmail(form.email);
    setErrors({
      phone: phoneResult.ok ? null : phoneResult.error,
      email: emailResult.ok ? null : emailResult.error,
    });
    if (!phoneResult.ok || !emailResult.ok) {
      toast({ title: "Please fix phone or email format", variant: "destructive" });
      return;
    }
    if (form.createLogin && form.password.length < 6) {
      toast({ title: "Portal password must be at least 6 characters", variant: "destructive" });
      return;
    }
    if (mapsEnabled) {
      if (!form.latitude.trim() || !form.longitude.trim()) {
        toast({
          title: "Pick a map location",
          description: "Search a place or drop a pin so we have coordinates for dispatch.",
          variant: "destructive",
        });
        return;
      }
    }
    if (!form.houseNumber.trim()) {
      toast({
        title: "Flat / House no. required",
        description: "Enter the flat, house, or unit number for this site.",
        variant: "destructive",
      });
      return;
    }
    if (!form.area.trim()) {
      toast({
        title: "Area / Street required",
        description: "Enter the colony, street, or locality staff should navigate to.",
        variant: "destructive",
      });
      return;
    }
    if (!form.city.trim()) {
      toast({
        title: "City required",
        description: "Select or confirm the city for this service address.",
        variant: "destructive",
      });
      return;
    }
    if (form.pincode.trim() && !/^\d{6}$/.test(form.pincode.trim())) {
      toast({
        title: "Invalid pincode",
        description: "Pincode must be 6 digits, or leave it blank.",
        variant: "destructive",
      });
      return;
    }
    const gstinValue = form.gstin.trim().toUpperCase();
    if (showBillingFields && gstinValue && !GSTIN_RE.test(gstinValue)) {
      toast({
        title: "Invalid GSTIN",
        description: "Leave GSTIN blank for retail customers, or enter all 15 characters (e.g. 09ABCDE1234F1Z5).",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const lat = form.latitude.trim() ? parseFloat(form.latitude) : undefined;
      const lng = form.longitude.trim() ? parseFloat(form.longitude) : undefined;
      const result = await createCustomerRequest({
        name: form.name,
        phone: phoneResult.value,
        email: emailResult.value,
        city: form.city || undefined,
        address: savedAddress || undefined,
        houseNumber: form.houseNumber.trim() || undefined,
        buildingName: form.buildingName.trim() || undefined,
        area: form.area.trim() || undefined,
        landmark: form.landmark.trim() || undefined,
        pincode: form.pincode.trim() || undefined,
        branchId: (form.branchId || defaultBranchId)
          ? parseInt(form.branchId || defaultBranchId, 10)
          : undefined,
        password: form.createLogin ? form.password : undefined,
        gstin: showBillingFields && gstinValue ? gstinValue : undefined,
        billingName: showBillingFields && form.billingName.trim() ? form.billingName.trim() : undefined,
        latitude: Number.isFinite(lat) ? lat : undefined,
        longitude: Number.isFinite(lng) ? lng : undefined,
        placeId: form.placeId.trim() || undefined,
        serviceLocationLabel: form.serviceLocationLabel.trim() || undefined,
      });

      if (!result.ok) {
        if (result.status === 409) {
          const existing = result.body.existingCustomerId
            ? {
              id: result.body.existingCustomerId,
              name: result.body.existingCustomerName,
            }
            : null;
          if (existing) {
            setDuplicateExisting(existing);
            onDuplicate?.(existing);
          }
          toast({
            title: "Contact already registered",
            description: result.body.error ?? "This mobile number or email is already in use.",
            variant: "destructive",
          });
          return;
        }
        throw new Error(result.body.error ?? "Failed to create customer");
      }

      setForm(emptyForm(defaultBranchId));
      setShowB2BBilling(false);
      setDuplicateExisting(null);
      if (result.data.loginWarning) {
        toast({ title: "Customer saved — login not created", description: result.data.loginWarning, variant: "destructive" });
      } else if (result.data.loginCreated) {
        toast({ title: "Customer created", description: `Login: ${result.data.phone}` });
      } else {
        toast({ title: "Customer created" });
      }
      onCreated(result.data);
    } catch (err) {
      toast({
        title: "Failed to create customer",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor={`${idPrefix}-name`}>Full Name</Label>
        <Input
          id={`${idPrefix}-name`}
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className="mt-1"
        />
      </div>
      <PhoneInput
        id={`${idPrefix}-phone`}
        label="Phone"
        value={form.phone}
        onChange={v => {
          setForm(f => ({ ...f, phone: v }));
          setDuplicateExisting(null);
        }}
        error={errors.phone}
        onErrorChange={err => setErrors(e => ({ ...e, phone: err }))}
      />
      <EmailInput
        id={`${idPrefix}-email`}
        label="Email"
        optional
        value={form.email}
        onChange={v => setForm(f => ({ ...f, email: v }))}
        error={errors.email}
        onErrorChange={err => setErrors(e => ({ ...e, email: err }))}
      />
      {branchOptions.length > 0 && (
        branchOptions.length === 1 ? (
          <p className="text-sm text-muted-foreground" data-testid={`${idPrefix}-branch-auto`}>
            Branch: <span className="text-foreground font-medium">{branchOptions[0].name}</span>
          </p>
        ) : (
          <div>
            <Label htmlFor={`${idPrefix}-branch`}>Branch</Label>
            <Select
              value={form.branchId}
              onValueChange={v => setForm(f => ({ ...f, branchId: v }))}
            >
              <SelectTrigger id={`${idPrefix}-branch`} className="mt-1" data-testid={`${idPrefix}-branch`}>
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {branchOptions.map(b => (
                  <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedBranch && form.branchId !== defaultBranchId && (
              <p className="text-xs text-muted-foreground mt-1">
                Defaults to your branch; change only if this customer belongs elsewhere.
              </p>
            )}
          </div>
        )
      )}
      <CustomerServiceAddressSection
        idPrefix={idPrefix}
        value={{
          serviceLocationLabel: form.serviceLocationLabel,
          houseNumber: form.houseNumber,
          buildingName: form.buildingName,
          area: form.area,
          landmark: form.landmark,
          pincode: form.pincode,
          city: form.city,
          latitude: form.latitude,
          longitude: form.longitude,
          placeId: form.placeId,
        }}
        onChange={patch => setForm(f => ({ ...f, ...patch }))}
      />
      {showBillingFields && (
        <div className="pt-2 border-t border-border">
          {!showB2BBilling ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-0 text-muted-foreground hover:text-foreground"
              onClick={() => setShowB2BBilling(true)}
              data-testid={`${idPrefix}-add-b2b-billing`}
            >
              + Add B2B billing details (optional)
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Optional — saved on the customer profile and used for GST invoices when provided. Leave blank for retail (B2C).
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 h-7 text-xs"
                  onClick={() => {
                    setShowB2BBilling(false);
                    setForm(f => ({ ...f, gstin: "", billingName: "" }));
                  }}
                  data-testid={`${idPrefix}-remove-b2b-billing`}
                >
                  Remove
                </Button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor={`${idPrefix}-billing-name`}>Billing name (optional)</Label>
                  <Input
                    id={`${idPrefix}-billing-name`}
                    value={form.billingName}
                    onChange={e => setForm(f => ({ ...f, billingName: e.target.value }))}
                    className="mt-1"
                    placeholder="Company legal name"
                    data-testid={`${idPrefix}-billing-name`}
                  />
                </div>
                <div>
                  <Label htmlFor={`${idPrefix}-gstin`}>GSTIN (optional)</Label>
                  <Input
                    id={`${idPrefix}-gstin`}
                    value={form.gstin}
                    onChange={e => setForm(f => ({ ...f, gstin: e.target.value.toUpperCase() }))}
                    className="mt-1 font-mono text-sm"
                    placeholder="Only if B2B"
                    maxLength={15}
                    data-testid={`${idPrefix}-gstin`}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.createLogin}
          onChange={e => setForm(f => ({ ...f, createLogin: e.target.checked }))}
        />
        Create app login
      </label>
      {form.createLogin && (
        <div>
          <Label htmlFor={`${idPrefix}-password`}>Portal password</Label>
          <PasswordInput
            id={`${idPrefix}-password`}
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            containerClassName="mt-1"
          />
        </div>
      )}
      {duplicateExisting && customerBasePath && (
        <div
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-2"
          data-testid={`${idPrefix}-duplicate-banner`}
        >
          <p className="text-sm">
            <span className="font-medium">{duplicateExisting.name ?? "This customer"}</span> is already registered with this phone.
          </p>
          <Link href={`${customerBasePath}/${duplicateExisting.id}`}>
            <Button variant="outline" size="sm" className="w-full" data-testid={`${idPrefix}-open-existing-customer`}>
              <ExternalLink size={14} className="mr-1.5" />
              Open existing customer
            </Button>
          </Link>
        </div>
      )}
      <Button
        onClick={() => void handleSubmit()}
        disabled={creating || !form.name.trim()}
        className="w-full "
      >
        {creating ? "Creating..." : submitLabel}
      </Button>
    </div>
  );
}
