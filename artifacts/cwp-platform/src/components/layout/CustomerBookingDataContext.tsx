import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, Users } from "lucide-react";

type BannerProps = {
  entityLabel: string;
  customerId?: number;
  customerName?: string;
};

type BackLinkProps = {
  customerId: number;
  customerName?: string;
  label?: string;
};

/** Link back to a customer's 360 profile from secondary admin views. */
export function CustomerProfileBackLink({ customerId, customerName, label }: BackLinkProps) {
  const href = `/admin/customers/${customerId}`;

  if (label) {
    return (
      <Link href={href} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ArrowLeft size={14} /> {label}
      </Link>
    );
  }

  return (
    <Link href={href}>
      <Button variant="outline" size="sm" data-testid={`back-to-customer-${customerId}`}>
        <ArrowLeft size={15} className="mr-1.5" />
        {customerName ? `Back to ${customerName}` : "Back to customer profile"}
      </Button>
    </Link>
  );
}

/** Standalone admin pages are secondary — booking data belongs on Customer Profile. */
export function CustomerBookingDataBanner({ entityLabel, customerId, customerName }: BannerProps) {
  if (customerId && customerName) {
    return (
      <Card className="border-border bg-muted/30">
        <CardContent className="pt-4 pb-4 text-sm text-muted-foreground">
          {entityLabel} for <strong className="text-foreground">{customerName}</strong>.
          {" "}Manage from{" "}
          <Link href={`/admin/customers/${customerId}`} className="text-primary hover:underline">
            Customer Profile
          </Link>
          {" "}when booking — not as a separate module.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="pt-4 pb-4 text-sm text-muted-foreground flex gap-2">
        <Users size={16} className="text-amber-600 shrink-0 mt-0.5" />
        <span>
          <strong className="text-foreground">{entityLabel}</strong> belong to customers and are added when you book.
          Start from{" "}
          <Link href="/admin/customers" className="text-primary hover:underline">
            Customer Profile
          </Link>
          , then use Book Service.
        </span>
      </CardContent>
    </Card>
  );
}
