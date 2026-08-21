import { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { LocationValue, SavedLocation, SavedLocationWrite } from "@/features/master-data/api";
import { CreateServiceAddressForm } from "./address-picker/CreateServiceAddressForm";
import { SavedAddressList } from "./address-picker/SavedAddressList";
import {
  addressFormToLocation,
  emptyAddressValue,
  formToWritePayload,
  locationToAddressForm,
  savedLocationToForm,
  savedLocationToLocationValue,
  type CustomerServiceAddressValue,
} from "./address-picker/addressForm";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: LocationValue | null;
  onSelect: (loc: LocationValue, meta?: { assetLabel?: string }) => void;
  savedLocations?: SavedLocation[];
  onSaveNew?: (data: SavedLocationWrite) => Promise<SavedLocation> | SavedLocation | void;
  onUpdate?: (id: number, data: SavedLocationWrite) => Promise<SavedLocation> | SavedLocation | void;
  onDelete?: (id: number) => Promise<void> | void;
  onSetDefault?: (id: number) => Promise<SavedLocation> | SavedLocation | void;
  customerId?: number;
};

export function AddressPickerSheet({
  open,
  onOpenChange,
  value,
  onSelect,
  savedLocations,
  onSaveNew,
  onUpdate,
  onDelete,
  onSetDefault,
  customerId,
}: Props) {
  const isMobile = useIsMobile();
  const hasSaved = Boolean(savedLocations && savedLocations.length > 0);
  const [mode, setMode] = useState<"list" | "new" | "edit">(hasSaved ? "list" : "new");
  const [editing, setEditing] = useState<SavedLocation | null>(null);
  const [addressForm, setAddressForm] = useState<CustomerServiceAddressValue>(() =>
    locationToAddressForm(value, "Home"),
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEditing(null);
    setAddressForm(locationToAddressForm(value, "Home"));
    setMode(hasSaved ? "list" : "new");
  }, [open, value, hasSaved]);

  const closeWith = (loc: LocationValue, label: string) => {
    onSelect(loc, { assetLabel: label });
    onOpenChange(false);
  };

  const saveNew = async () => {
    const draft = addressFormToLocation(addressForm);
    if (!draft || customerId == null) return;
    setSubmitting(true);
    try {
      const payload = formToWritePayload(addressForm, customerId, !hasSaved);
      const created = await onSaveNew?.(payload);
      const selected = created
        ? savedLocationToLocationValue(created)
        : { ...draft, savedLocationId: undefined };
      closeWith(selected, addressForm.serviceLocationLabel.trim() || "Home");
    } finally {
      setSubmitting(false);
    }
  };

  const saveEdit = async () => {
    if (!editing || customerId == null) return;
    const draft = addressFormToLocation(addressForm);
    if (!draft) return;
    setSubmitting(true);
    try {
      const payload = formToWritePayload(addressForm, customerId, editing.isDefault);
      const updated = await onUpdate?.(editing.id, payload);
      const selected = updated ? savedLocationToLocationValue(updated) : { ...draft, savedLocationId: editing.id };
      closeWith(selected, addressForm.serviceLocationLabel.trim() || editing.label);
    } finally {
      setSubmitting(false);
    }
  };

  const body = mode === "list" && savedLocations && savedLocations.length > 0 ? (
    <SavedAddressList
      savedLocations={savedLocations}
      value={value}
      onSelect={loc => closeWith(loc, loc.savedLocationId
        ? (savedLocations.find(s => s.id === loc.savedLocationId)?.label ?? "Saved")
        : "Saved")}
      onAddNew={() => {
        setAddressForm(emptyAddressValue("Home"));
        setMode("new");
      }}
      onEdit={loc => {
        setEditing(loc);
        setAddressForm(savedLocationToForm(loc));
        setMode("edit");
      }}
      onDelete={onDelete ? async loc => { await onDelete(loc.id); } : undefined}
      onSetDefault={onSetDefault ? async loc => { await onSetDefault(loc.id); } : undefined}
    />
  ) : (
    <CreateServiceAddressForm
      idPrefix={mode === "edit" ? "address-edit" : "address-picker"}
      value={addressForm}
      onChange={patch => setAddressForm(prev => ({ ...prev, ...patch }))}
      ctaLabel="Save address"
      submitting={submitting}
      onSubmit={mode === "edit" ? saveEdit : saveNew}
    />
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl px-5 pb-6 pt-4 max-h-[92dvh] overflow-y-auto"
          data-testid="address-picker-sheet"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Where should we come?</SheetTitle>
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" data-testid="address-picker-dialog">
        <DialogHeader className="sr-only">
          <DialogTitle>Where should we come?</DialogTitle>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}
