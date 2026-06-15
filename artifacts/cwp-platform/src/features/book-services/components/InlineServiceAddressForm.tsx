import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  createServiceLocation,
  type CustomerServiceLocationRow,
} from "@/features/service-locations/api";
import {
  EMPTY_SERVICE_LOCATION_FORM,
  ServiceLocationForm,
} from "@/features/service-locations/components/ServiceLocationForm";

type Props = {
  customerId: number;
  onCreated: (location: CustomerServiceLocationRow) => void;
  onCancel?: () => void;
};

export function InlineServiceAddressForm({ customerId, onCreated, onCancel }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [values, setValues] = useState({
    ...EMPTY_SERVICE_LOCATION_FORM,
    label: "Primary",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!values.label.trim() || !values.address.trim()) {
      toast({ title: "Site label and address are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const created = await createServiceLocation({
        customerId,
        label: values.label.trim(),
        address: values.address.trim(),
        city: values.city.trim() || undefined,
        locationType: values.locationType,
        status: values.status,
        isDefault: true,
      });
      await qc.invalidateQueries({ queryKey: ["book-services", "locations", customerId] });
      onCreated({
        ...created,
        linkId: 0,
        isDefault: true,
        effectiveFrom: null,
        effectiveUntil: null,
      } as CustomerServiceLocationRow);
      toast({ title: "Service address added" });
    } catch (e) {
      toast({
        title: "Could not add address",
        description: e instanceof Error ? e.message : "Error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-primary/30 bg-primary/5 p-4" data-testid="inline-add-service-address">
      <p className="text-sm font-medium text-foreground">Add service address</p>
      <ServiceLocationForm values={values} onChange={setValues} idPrefix="book-inline-location" />
      <div className="flex gap-2">
        <Button type="button" onClick={() => void handleSave()} disabled={saving} data-testid="btn-save-inline-address">
          {saving ? "Saving…" : "Save & continue"}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
