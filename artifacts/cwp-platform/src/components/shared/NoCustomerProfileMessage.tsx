import { useBranding } from "@/lib/branding";

/** Shown when a customer login is not linked to a profile */
export function NoCustomerProfileMessage() {
  const branding = useBranding();
  return (
    <p className="text-sm text-muted-foreground">
      Your login is not linked to a customer profile. Contact {branding.brandName || "support"} support.
    </p>
  );
}
