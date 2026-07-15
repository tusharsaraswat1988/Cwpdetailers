import { Link } from "wouter";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { ASSET_TYPE_LABELS } from "@/features/assets/api";
import {
  type BookServicesDraft,
  paymentTermsLabel,
} from "../types";
import {
  type ServiceContractResult,
  type ContractBillingResult,
  fulfillmentLabel,
} from "../api";

type Props = {
  draft: BookServicesDraft;
  result: ServiceContractResult;
  billing?: ContractBillingResult | null;
  onBookAnother: () => void;
};

function formatMoney(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

export function ContractCreatedStep({ draft, result, billing, onBookAnother }: Props) {
  const gst = billing?.gstSummary;

  return (
    <div className="space-y-4" data-testid="book-contract-created">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-8 w-8 text-green-600 shrink-0" />
        <div>
          <h2 className="font-display font-semibold text-lg">Sale recorded</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Booking saved, bill created, and job added to Assign Service for your team.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Booking &amp; billing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Customer" value={draft.customer ? `${draft.customer.name}` : "—"} />
          <Row label="Service address" value={draft.location?.label ?? "—"} />
          <Row
            label={draft.asset?.assetType === "solar_site" ? "Solar site" : "Vehicle"}
            value={draft.asset ? `${draft.asset.label} (${ASSET_TYPE_LABELS[draft.asset.assetType]})` : "—"}
          />
          <Row label="Service" value={draft.service?.name ?? result.label} />
          <Row label="Type" value={fulfillmentLabel(result.contractType)} />
          <Row label="Booking ref" value={`#${result.registryId}`} />
          {result.bookingId && <Row label="Job reference" value={`#${result.bookingId}`} />}
          <Row label="Payment terms" value={paymentTermsLabel(draft.paymentTerms)} />

          {billing?.quotationId && (
            <Row
              label="Quotation"
              value={
                <Link href="/admin/billing?tab=quotations" className="text-primary hover:underline">
                  {billing.quotationNumber ?? `#${billing.quotationId}`}
                </Link>
              }
            />
          )}
          {billing?.invoiceId && (
            <Row
              label="Invoice"
              value={
                <Link href="/admin/billing?tab=invoices" className="text-primary hover:underline">
                  {billing.invoiceNumber ?? `#${billing.invoiceId}`}
                </Link>
              }
            />
          )}
          {billing?.pendingAssignmentId && (
            <Row label="Assignment" value="Pending (Sprint 6)" />
          )}

          {gst && (
            <div className="border-t border-border pt-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">GST summary</p>
              <div className="flex justify-between text-muted-foreground">
                <span>Taxable value</span>
                <span>{formatMoney(gst.subtotal)}</span>
              </div>
              {gst.cgstAmount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>CGST</span>
                  <span>{formatMoney(gst.cgstAmount)}</span>
                </div>
              )}
              {gst.sgstAmount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>SGST</span>
                  <span>{formatMoney(gst.sgstAmount)}</span>
                </div>
              )}
              {gst.igstAmount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>IGST</span>
                  <span>{formatMoney(gst.igstAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold pt-1">
                <span>Total</span>
                <span>{formatMoney(gst.totalAmount)}</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="outline">{gst.isCorporate ? "B2B (GSTIN)" : "B2C Retail"}</Badge>
                {gst.isInterState && <Badge variant="outline">Inter-state</Badge>}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Badge>{result.status}</Badge>
            {billing?.quotationId && <Badge variant="secondary">Quotation sent</Badge>}
            {billing?.invoiceId && <Badge variant="secondary">Invoiced</Badge>}
            <Badge variant="outline">Pending assignment</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={onBookAnother} data-testid="book-another-service">
          Book another service
        </Button>
        {draft.customer?.id && (
          <Link href={`/admin/bookings?customerId=${draft.customer.id}`}>
            <Button variant="outline">View this customer&apos;s bookings</Button>
          </Link>
        )}
        <Link href="/admin/assign-services">
          <Button variant="outline">Go to Assign Service</Button>
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
