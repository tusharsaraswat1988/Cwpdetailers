import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { BookServicesDraft } from "../types";

type Props = {
  draft: BookServicesDraft;
  onChange: (patch: Partial<BookServicesDraft>) => void;
};

async function createSolarCallbackLead(draft: BookServicesDraft): Promise<number> {
  const customer = draft.customer;
  if (!customer) throw new Error("Customer required");
  const panels = draft.solarPanelCount;
  const term = draft.service?.solarTerm ?? "one_time";
  const notes = [
    "Solar site visit / callback request",
    `Panels: ${panels ?? "unknown"}`,
    `Term: ${term}`,
    `Service: ${draft.service?.name ?? "—"}`,
    draft.location ? `Location: ${draft.location.label ?? draft.location.address ?? draft.location.id}` : null,
    draft.requestNotes?.trim() || null,
  ].filter(Boolean).join("\n");

  const res = await fetch("/api/leads", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: customer.name,
      phone: customer.phone,
      city: "Varanasi",
      source: draft.requestSource || "walk_in",
      serviceInterest: "solar",
      notes,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Failed to create callback lead");
  return body.id as number;
}

export function SolarQuotePanel({ draft, onChange }: Props) {
  const { toast } = useToast();
  const [creatingLead, setCreatingLead] = useState(false);
  const status = draft.solarPricingStatus;

  if (draft.asset?.assetType !== "solar_site") return null;

  const requestCallback = async () => {
    setCreatingLead(true);
    try {
      const id = await createSolarCallbackLead(draft);
      onChange({ solarCallbackLeadId: id });
      toast({ title: "Callback lead created", description: `Lead #${id} — schedule site visit, then enter finalized amount.` });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed to create lead", variant: "destructive" });
    } finally {
      setCreatingLead(false);
    }
  };

  return (
    <section className="rounded-lg border border-border p-4 space-y-3" data-testid="solar-quote-panel">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium">Solar rate card</h3>
        {status === "priced" && <Badge variant="secondary">Quoted</Badge>}
        {status === "needs_site_visit" && <Badge variant="outline">Site visit required</Badge>}
        {status === "no_slab" && <Badge variant="destructive">No slab</Badge>}
        {status === "manual" && <Badge>Manual</Badge>}
        {status === "loading" && <Badge variant="outline">Loading…</Badge>}
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-muted-foreground">Panels</span>
          <p className="font-medium tabular-nums">{draft.solarPanelCount ?? "—"}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Term</span>
          <p className="font-medium">{draft.service?.solarTerm ?? "—"}</p>
        </div>
        {status === "priced" && (
          <>
            <div>
              <span className="text-muted-foreground">₹/panel</span>
              <p className="font-medium tabular-nums">{draft.solarPricePerPanel ?? "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Min billing</span>
              <p className="font-medium tabular-nums">₹{(draft.solarMinimumBilling ?? 0).toLocaleString("en-IN")}</p>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">Quoted subtotal (GST extra)</span>
              <p className="font-semibold text-base tabular-nums">
                ₹{(draft.solarQuotedSubtotal ?? 0).toLocaleString("en-IN")}
              </p>
            </div>
          </>
        )}
      </div>

      {(status === "needs_site_visit" || status === "no_slab") && (
        <div className="space-y-3 rounded-md bg-muted/40 p-3">
          <p className="text-sm text-muted-foreground">
            {status === "needs_site_visit"
              ? "This panel count requires a site visit. Create a callback lead, visit the site, then enter the finalized amount below and continue the normal booking flow."
              : "No active rate-card row matches. Enter a manual amount or configure slabs under Products → Solar."}
          </p>
          {status === "needs_site_visit" && (
            <Button type="button" variant="secondary" disabled={creatingLead || !!draft.solarCallbackLeadId} onClick={requestCallback}>
              {draft.solarCallbackLeadId ? `Callback lead #${draft.solarCallbackLeadId}` : creatingLead ? "Creating…" : "Request callback / site visit"}
            </Button>
          )}
          <div>
            <Label>Finalized amount (₹, GST extra)</Label>
            <Input
              className="mt-1"
              inputMode="decimal"
              value={draft.solarManualAmount}
              onChange={e => onChange({ solarManualAmount: e.target.value, solarPricingStatus: "manual" })}
              placeholder="Enter after site visit"
            />
          </div>
        </div>
      )}

      {status === "priced" && (
        <div>
          <Label className="text-xs text-muted-foreground">Override amount (optional)</Label>
          <Input
            className="mt-1"
            inputMode="decimal"
            value={draft.solarManualAmount}
            onChange={e => {
              const v = e.target.value;
              onChange({
                solarManualAmount: v,
                solarPricingStatus: v.trim() ? "manual" : "priced",
              });
            }}
            placeholder="Leave blank to use rate card"
          />
        </div>
      )}
    </section>
  );
}
