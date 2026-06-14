import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

type Props = {
  customerId: number;
  customerBasePath: string;
  name?: string | null;
  className?: string;
};

/** Link button to customer 360 profile from leads / churned / etc. */
export function CustomerProfileLink({ customerId, customerBasePath, name, className }: Props) {
  return (
    <Link href={`${customerBasePath}/${customerId}`}>
      <Button
        variant="outline"
        size="sm"
        className={className ?? "h-8 text-xs"}
        data-testid={`btn-view-customer-profile-${customerId}`}
      >
        <ExternalLink size={12} className="mr-1.5" />
        {name ? `View ${name}` : "View customer profile"}
      </Button>
    </Link>
  );
}
