import { forwardRef, useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type PasswordInputProps = Omit<ComponentProps<typeof Input>, "type"> & {
  label?: string;
  hint?: string;
  containerClassName?: string;
};

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { label, hint, className, containerClassName, id, ...props },
  ref,
) {
  const [visible, setVisible] = useState(false);

  const field = (
    <div className={cn("relative", label && "mt-1", containerClassName)}>
      <Input
        ref={ref}
        id={id}
        type={visible ? "text" : "password"}
        className={cn("pr-10", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded"
        aria-label={visible ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        {visible ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
      </button>
    </div>
  );

  if (!label) return field;

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {field}
      {hint ? <p className="text-xs text-muted-foreground mt-1">{hint}</p> : null}
    </div>
  );
});
