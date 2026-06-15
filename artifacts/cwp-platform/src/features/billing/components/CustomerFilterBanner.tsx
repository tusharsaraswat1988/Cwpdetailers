import { useGetCustomer } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { X, User } from "lucide-react";
import { Link } from "wouter";

type Props = {
  customerId: number;
  onClear: () => void;
};

export function CustomerFilterBanner({ customerId, onClear }: Props) {
  const { data: customer, isLoading } = useGetCustomer(customerId, {
    query: { enabled: customerId > 0 },
  });

  if (customerId <= 0) return null;

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm"
      data-testid="billing-customer-filter-banner"
    >
      <div className="flex items-center gap-2 min-w-0">
        <User size={16} className="text-primary shrink-0" />
        {isLoading ? (
          <Skeleton className="h-4 w-40" />
        ) : (
          <span>
            Filtered to customer:{" "}
            <Link href={`/admin/customers/${customerId}?tab=billing`} className="font-medium text-primary hover:underline">
              {customer?.name ?? `Customer #${customerId}`}
            </Link>
          </span>
        )}
      </div>
      <Button variant="ghost" size="sm" className="h-8 shrink-0" onClick={onClear} data-testid="btn-clear-customer-filter">
        <X size={14} className="mr-1" /> Clear filter
      </Button>
    </div>
  );
}
