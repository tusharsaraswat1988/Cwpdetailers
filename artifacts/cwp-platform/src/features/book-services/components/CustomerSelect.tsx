import { useState } from "react";
import { CustomerSearchSelect, type CustomerSearchValue } from "@/features/customers/components/CustomerSearchSelect";
import { QuickCreateCustomerForm } from "@/features/customers/components/QuickCreateCustomerForm";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
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
};

export function CustomerSelect({
  value,
  requestSource,
  requestNotes,
  onChange,
  onMetaChange,
}: Props) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-5" data-testid="book-step-customer">
      <div>
        <Label className="text-base">Who is requesting service?</Label>
        <p className="text-sm text-muted-foreground mt-0.5">
          Search an existing customer, or create one here without leaving this request.
        </p>
      </div>

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
            onClick={() => onChange(null)}
            data-testid="book-customer-change"
          >
            Change
          </Button>
        </div>
      ) : !showCreate ? (
        <div className="space-y-3">
          <CustomerSearchSelect
            value={value}
            onChange={onChange}
            placeholder="Search by name or phone…"
            testId="book-customer-select"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowCreate(true)}
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
              onClick={() => setShowCreate(false)}
            >
              Back to search
            </Button>
          </div>
          <QuickCreateCustomerForm
            idPrefix="sx-customer"
            submitLabel="Save customer & continue"
            showBillingFields
            onCreated={(c) => {
              onChange({ id: c.id, name: c.name, phone: c.phone });
              setShowCreate(false);
            }}
            onDuplicate={(existing) => {
              if (!existing.id) return;
              void (async () => {
                try {
                  const res = await fetch(`/api/customers/${existing.id}`, { credentials: "include" });
                  if (res.ok) {
                    const row = await res.json() as { id: number; name: string; phone: string };
                    onChange({ id: row.id, name: row.name, phone: row.phone });
                  } else {
                    onChange({
                      id: existing.id,
                      name: existing.name ?? "Existing customer",
                      phone: "",
                    });
                  }
                } catch {
                  onChange({
                    id: existing.id,
                    name: existing.name ?? "Existing customer",
                    phone: "",
                  });
                }
                setShowCreate(false);
              })();
            }}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label>How did this request come in?</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="listbox" aria-label="Request source">
          {REQUEST_SOURCE_OPTIONS.map(opt => {
            const selected = requestSource === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => onMetaChange({ requestSource: opt.id })}
                data-testid={`book-source-${opt.id}`}
                className={cn(
                  "min-h-11 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                  selected
                    ? "border-primary bg-primary/5 font-medium"
                    : "border-border hover:border-primary/40",
                )}
              >
                {opt.label}
                {selected && <Badge className="ml-1.5 text-[10px] align-middle">Selected</Badge>}
              </button>
            );
          })}
        </div>
      </div>

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
