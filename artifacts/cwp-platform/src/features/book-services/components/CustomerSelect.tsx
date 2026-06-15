import { CustomerSearchSelect, type CustomerSearchValue } from "@/features/customers/components/CustomerSearchSelect";
import { Label } from "@/components/ui/label";

type Props = {
  value: CustomerSearchValue | null;
  onChange: (customer: CustomerSearchValue | null) => void;
};

export function CustomerSelect({ value, onChange }: Props) {
  return (
    <div className="space-y-2" data-testid="book-step-customer">
      <Label>Who is this job for?</Label>
      {value ? (
        <p className="text-sm text-muted-foreground">
          Booking for <span className="font-medium text-foreground">{value.name}</span> · {value.phone}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Search by customer name or phone number.</p>
      )}
      <CustomerSearchSelect
        value={value}
        onChange={onChange}
        placeholder={value ? `${value.name} · ${value.phone}` : "Search customer…"}
        testId="book-customer-select"
      />
    </div>
  );
}
