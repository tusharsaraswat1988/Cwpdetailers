import { useState } from "react";
import { CustomerSearchSelect, type CustomerSearchValue } from "@/features/customers/components/CustomerSearchSelect";
import { QuickCreateCustomerForm } from "@/features/customers/components/QuickCreateCustomerForm";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, UserRound } from "lucide-react";
import {
  REQUEST_SOURCE_OPTIONS,
  type RequestSource,
} from "../types";

type Props = {
  value: CustomerSearchValue | null;
  requestSource: RequestSource;
  requestNotes: string;
  onChange: (customer: CustomerSearchValue | null) => void;
  onMetaChange: (patch: { requestSource?: RequestSource; requestNotes?: string }) => void;
  /** Fired when inline create panel opens/closes — wizard hides Next while open. */
  onInlineCreateOpenChange?: (open: boolean) => void;
};

export function CustomerSelect({
  value,
  requestSource,
  requestNotes,
  onChange,
  onMetaChange,
  onInlineCreateOpenChange,
}: Props) {
  const [showCreate, setShowCreate] = useState(false);
  /** True only when the customer was created inline in this session (first-time intake). */
  const [newIntake, setNewIntake] = useState(false);

  const setCreateOpen = (open: boolean) => {
    setShowCreate(open);
    onInlineCreateOpenChange?.(open);
  };

  const handleExistingSelect = (customer: CustomerSearchValue | null) => {
    setNewIntake(false);
    if (customer) onMetaChange({ requestSource: "walk_in" });
    onChange(customer);
  };

  return (
    <div className="space-y-5" data-testid="book-step-customer">
      <p className="text-sm text-muted-foreground">
        Search an existing customer, or create one here without leaving this request.
      </p>

      {value && !showCreate ? (
        <div
          className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 flex items-start justify-between gap-3"
          data-testid="book-customer-selected"
        >
          <div className="flex items-start gap-2 min-w-0">
            <UserRound className="h-4 w-4 text-primary mt-0.5 shrink-0" aria-hidden />
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{value.name}</p>
              <p className="text-xs text-muted-foreground">{value.phone}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 h-8 text-xs"
            onClick={() => {
              setNewIntake(false);
              onChange(null);
            }}
            data-testid="book-customer-change"
          >
            Change
          </Button>
        </div>
      ) : !showCreate ? (
        <div className="space-y-3">
          <CustomerSearchSelect
            value={value}
            onChange={handleExistingSelect}
            placeholder="Search by name or phone…"
            testId="book-customer-select"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => setCreateOpen(true)}
            data-testid="btn-create-customer-inline"
            className="w-full sm:w-auto"
          >
            <Plus size={14} className="mr-1.5" />
            New customer — create inline
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-border p-4 space-y-3" data-testid="book-inline-create-customer">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Create customer</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setCreateOpen(false)}
            >
              Back to search
            </Button>
          </div>
          <QuickCreateCustomerForm
            idPrefix="sx-customer"
            submitLabel="Save customer & continue"
            showBillingFields
            onCreated={(c) => {
              setNewIntake(true);
              onChange({ id: c.id, name: c.name, phone: c.phone });
              setCreateOpen(false);
            }}
            onDuplicate={(existing) => {
              if (!existing.id) return;
              void (async () => {
                try {
                  const res = await fetch(`/api/customers/${existing.id}`, { credentials: "include" });
                  if (res.ok) {
                    const row = await res.json() as { id: number; name: string; phone: string };
                    setNewIntake(false);
                    onMetaChange({ requestSource: "walk_in" });
                    onChange({ id: row.id, name: row.name, phone: row.phone });
                  } else {
                    setNewIntake(false);
                    onMetaChange({ requestSource: "walk_in" });
                    onChange({
                      id: existing.id,
                      name: existing.name ?? "Existing customer",
                      phone: "",
                    });
                  }
                } catch {
                  setNewIntake(false);
                  onMetaChange({ requestSource: "walk_in" });
                  onChange({
                    id: existing.id,
                    name: existing.name ?? "Existing customer",
                    phone: "",
                  });
                }
                setCreateOpen(false);
              })();
            }}
          />
        </div>
      )}

      {value && newIntake && (
        <div className="space-y-1.5">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
            <Label htmlFor="book-request-source" className="text-sm shrink-0 sm:min-w-[10rem]">
              How did they reach us?
            </Label>
            <Select
              value={requestSource}
              onValueChange={v => onMetaChange({ requestSource: v as RequestSource })}
            >
              <SelectTrigger id="book-request-source" className="h-9 sm:max-w-xs" data-testid="book-request-source">
                <SelectValue placeholder="Select channel" />
              </SelectTrigger>
              <SelectContent>
                {REQUEST_SOURCE_OPTIONS.map(opt => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            New customer intake — records how this lead first arrived.
          </p>
        </div>
      )}

      <div>
        <Label htmlFor="sx-request-notes">Notes for the team (optional)</Label>
        <Textarea
          id="sx-request-notes"
          value={requestNotes}
          onChange={e => onMetaChange({ requestNotes: e.target.value })}
          placeholder="Gate code, preferred time, corporate PO, referral name…"
          className="mt-1 min-h-[72px]"
          data-testid="book-request-notes"
        />
      </div>
    </div>
  );
}
