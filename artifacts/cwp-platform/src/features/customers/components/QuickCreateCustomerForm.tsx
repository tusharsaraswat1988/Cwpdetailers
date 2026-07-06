import { useState } from "react";
import { Link } from "wouter";
import { useListBranches, getListBranchesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhoneInput } from "@/components/ui/phone-input";
import { EmailInput } from "@/components/ui/email-input";
import { submitEmail, submitMobile } from "@/lib/contactForm";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink } from "lucide-react";
import { createCustomerRequest, type CreateCustomerResult } from "../api";

export type QuickCreateCustomerDialogProps = {
  onCreated: (customer: CreateCustomerResult) => void;
  onDuplicate?: (existing: { id: number; name?: string }) => void;
  /** Base path for "Open existing customer" on duplicate phone, e.g. /admin/customers */
  customerBasePath?: string;
  submitLabel?: string;
  idPrefix?: string;
  showBillingFields?: boolean;
};

const EMPTY = {
  name: "",
  phone: "",
  email: "",
  city: "",
  address: "",
  branchId: "",
  createLogin: true,
  password: "customer123",
  gstin: "",
  billingName: "",
};

export function QuickCreateCustomerForm({
  onCreated,
  onDuplicate,
  customerBasePath = "/admin/customers",
  submitLabel = "Create Customer",
  idPrefix = "quick-customer",
  showBillingFields = false,
}: QuickCreateCustomerDialogProps) {
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<{ phone?: string | null; email?: string | null }>({});
  const [creating, setCreating] = useState(false);
  const [duplicateExisting, setDuplicateExisting] = useState<{ id: number; name?: string } | null>(null);
  const { data: branches } = useListBranches({ query: { queryKey: getListBranchesQueryKey() } });

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

    setCreating(true);
    try {
      const result = await createCustomerRequest({
        name: form.name,
        phone: phoneResult.value,
        email: emailResult.value,
        city: form.city || undefined,
        address: form.address || undefined,
        branchId: form.branchId ? parseInt(form.branchId, 10) : undefined,
        password: form.createLogin ? form.password : undefined,
        gstin: showBillingFields && form.gstin.trim() ? form.gstin.trim() : undefined,
        billingName: showBillingFields && form.billingName.trim() ? form.billingName.trim() : undefined,
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

      setForm(EMPTY);
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
      <div>
        <Label>Branch</Label>
        <Select value={form.branchId || "none"} onValueChange={v => setForm(f => ({ ...f, branchId: v === "none" ? "" : v }))}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select branch (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Default branch</SelectItem>
            {(branches ?? []).map(b => (
              <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {[["city", "City"], ["address", "Address"]].map(([k, l]) => (
        <div key={k}>
          <Label htmlFor={`${idPrefix}-${k}`}>{l}</Label>
          <Input
            id={`${idPrefix}-${k}`}
            value={form[k as keyof typeof form] as string}
            onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
            className="mt-1"
          />
        </div>
      ))}
      {showBillingFields && (
        <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-border">
          <div>
            <Label htmlFor={`${idPrefix}-billing-name`}>Billing name (B2B)</Label>
            <Input
              id={`${idPrefix}-billing-name`}
              value={form.billingName}
              onChange={e => setForm(f => ({ ...f, billingName: e.target.value }))}
              className="mt-1"
              placeholder="Optional"
              data-testid={`${idPrefix}-billing-name`}
            />
          </div>
          <div>
            <Label htmlFor={`${idPrefix}-gstin`}>GSTIN</Label>
            <Input
              id={`${idPrefix}-gstin`}
              value={form.gstin}
              onChange={e => setForm(f => ({ ...f, gstin: e.target.value.toUpperCase() }))}
              className="mt-1 font-mono text-sm"
              placeholder="09ABCDE1234F1Z5"
              maxLength={15}
              data-testid={`${idPrefix}-gstin`}
            />
          </div>
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
        className="w-full bg-primary text-secondary hover:bg-primary/90"
      >
        {creating ? "Creating..." : submitLabel}
      </Button>
    </div>
  );
}
