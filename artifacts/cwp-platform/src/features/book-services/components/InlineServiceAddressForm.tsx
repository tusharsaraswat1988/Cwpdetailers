import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  createServiceLocation,
  updateServiceLocation,
  type CustomerServiceLocationRow,
} from "@/features/service-locations/api";
import {
  EMPTY_SERVICE_LOCATION_FORM,
  ServiceLocationForm,
  serviceLocationFormToPayload,
  serviceLocationToFormValues,
} from "@/features/service-locations/components/ServiceLocationForm";

type Props = {
  customerId: number;
  /** When set, form updates this address instead of creating a new one. */
  editing?: CustomerServiceLocationRow | null;
  onCreated: (location: CustomerServiceLocationRow) => void;
  onUpdated?: (location: CustomerServiceLocationRow) => void;
  onCancel?: () => void;
  /** Suggested default name — leave empty so the user types a real label. */
  suggestedLabel?: string;
};

export function InlineServiceAddressForm({
  customerId,
  editing = null,
  onCreated,
  onUpdated,
  onCancel,
  suggestedLabel = "",
}: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [values, setValues] = useState(() =>
    editing
      ? serviceLocationToFormValues(editing)
      : { ...EMPTY_SERVICE_LOCATION_FORM, label: suggestedLabel },
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setValues(serviceLocationToFormValues(editing));
    } else {
      setValues({ ...EMPTY_SERVICE_LOCATION_FORM, label: suggestedLabel });
    }
  }, [editing?.id, suggestedLabel]);

  const handleSave = async () => {
    if (!values.label.trim()) {
      toast({ title: "Site label is required", description: "e.g. Home, Office, Factory", variant: "destructive" });
      return;
    }
    if (!values.address.trim() || !values.latitude.trim() || !values.longitude.trim()) {
      toast({
        title: "Pick a location on the map",
        description: "Search an address or drop a pin so we have coordinates for dispatch.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const payload = serviceLocationFormToPayload(values);
      if (editing) {
        const updated = await updateServiceLocation(editing.id, payload);
        await qc.invalidateQueries({ queryKey: ["book-services", "locations", customerId] });
        const merged: CustomerServiceLocationRow = {
          ...editing,
          ...updated,
        };
        (onUpdated ?? onCreated)(merged);
        toast({ title: "Address updated", description: values.label.trim() });
      } else {
        const created = await createServiceLocation({
          customerId,
          ...payload,
          isDefault: false,
        });
        await qc.invalidateQueries({ queryKey: ["book-services", "locations", customerId] });
        onCreated({
          ...created,
          linkId: 0,
          isDefault: false,
          effectiveFrom: null,
          effectiveUntil: null,
        } as CustomerServiceLocationRow);
        toast({ title: "Address saved", description: values.label.trim() });
      }
    } catch (e) {
      toast({
        title: editing ? "Could not update address" : "Could not add address",
        description: e instanceof Error ? e.message : "Error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="space-y-4 rounded-lg border border-primary/30 bg-primary/5 p-4"
      data-testid={editing ? "inline-edit-service-address" : "inline-add-service-address"}
    >
      <div>
        <p className="text-sm font-medium text-foreground">
          {editing ? "Edit service address" : "Add service address"}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {editing
            ? "Update the name, street, or map pin for this site."
            : "Give it a clear name (e.g. Home, Factory, BHU Campus) — not a generic “Primary”."}
        </p>
      </div>
      <ServiceLocationForm
        values={values}
        onChange={setValues}
        idPrefix={editing ? `book-edit-location-${editing.id}` : "book-inline-location"}
      />
      <div className="flex gap-2">
        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          data-testid={editing ? "btn-update-inline-address" : "btn-save-inline-address"}
        >
          {saving ? "Saving…" : editing ? "Save changes" : "Save address"}
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
