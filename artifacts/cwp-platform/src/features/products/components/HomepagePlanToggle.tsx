import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Props = {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
};

export function HomepagePlanToggle({ checked, disabled, onChange, className }: Props) {
  return (
    <div className={cn("flex items-center justify-between gap-2 text-xs", className)}>
      <span className="text-muted-foreground">Show on homepage</span>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        aria-label="Show on homepage"
      />
    </div>
  );
}
