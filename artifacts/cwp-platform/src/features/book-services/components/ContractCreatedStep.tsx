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
  fulfillmentLabel,
} from "../api";

type Props = {
  draft: BookServicesDraft;
  result: ServiceContractResult;
  onBookAnother: () => void;
};

export function ContractCreatedStep({ draft, result, onBookAnother }: Props) {
  return (
    <div className="space-y-4" data-testid="book-contract-created">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-8 w-8 text-green-600 shrink-0" />
        <div>
          <h2 className="font-display font-semibold text-lg">Active plan created</h2>
          <p className="text-sm text-muted-foreground mt-1">
            The service contract is registered. Billing and assignment will be handled in later steps.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Contract summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Customer" value={draft.customer ? `${draft.customer.name}` : "—"} />
          <Row label="Location" value={draft.location?.label ?? "—"} />
          <Row
            label="Asset"
            value={draft.asset ? `${draft.asset.label} (${ASSET_TYPE_LABELS[draft.asset.assetType]})` : "—"}
          />
          <Row label="Service" value={draft.service?.name ?? result.label} />
          <Row label="Type" value={fulfillmentLabel(result.contractType)} />
          <Row label="Registry ID" value={`#${result.registryId}`} />
          {result.bookingId && <Row label="Job reference" value={`#${result.bookingId}`} />}
          <Row label="Payment terms" value={paymentTermsLabel(draft.paymentTerms)} />
          <div className="flex flex-wrap gap-2 pt-2">
            <Badge>{result.status}</Badge>
            <Badge variant="outline">No invoice yet</Badge>
            <Badge variant="outline">No assignment yet</Badge>
          </div>
        </CardContent>
      </Card>

      <Button onClick={onBookAnother} data-testid="book-another-service">
        Book another service
      </Button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
