import { forwardRef, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { sanitizeEmailInput, validateEmail, EMAIL_ERRORS } from "@workspace/validation";

type EmailInputProps = Omit<ComponentProps<typeof Input>, "type" | "value" | "onChange"> & {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  onErrorChange?: (error: string | null) => void;
  required?: boolean;
  optional?: boolean;
  hint?: string;
};

export const EmailInput = forwardRef<HTMLInputElement, EmailInputProps>(function EmailInput(
  {
    label,
    value,
    onChange,
    error,
    onErrorChange,
    required = false,
    optional = true,
    hint,
    className,
    id,
    ...props
  },
  ref,
) {
  const validate = (raw: string) => validateEmail(raw, { required: required && !optional });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(sanitizeEmailInput(e.target.value));
    if (error && onErrorChange) onErrorChange(null);
  };

  const handleBlur = () => {
    if (!onErrorChange) return;
    const result = validate(value);
    onErrorChange(result.ok ? null : result.error);
  };

  return (
    <div>
      {label && (
        <Label htmlFor={id} className="text-sm">
          {label}
        </Label>
      )}
      <Input
        ref={ref}
        id={id}
        type="email"
        inputMode="email"
        autoComplete="email"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        aria-invalid={!!error}
        className={cn(label && "mt-1", error && "border-destructive focus-visible:ring-destructive", className)}
        placeholder="name@example.com"
        {...props}
      />
      {error ? (
        <p className="text-destructive text-xs mt-1" role="alert">
          {error}
        </p>
      ) : (
        <p className="text-muted-foreground text-xs mt-1">{hint ?? "Valid email format required if provided"}</p>
      )}
    </div>
  );
});

export function validateEmailValue(
  value: string,
  { required = false, optional = true } = {},
): string | null {
  const result = validateEmail(value, { required: required && !optional });
  return result.ok ? null : result.error;
}

export { EMAIL_ERRORS };
