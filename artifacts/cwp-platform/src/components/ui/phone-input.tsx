import { forwardRef, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  sanitizePhoneInput,
  validateIndianMobile,
  validateContactPhone,
  PHONE_ERRORS,
} from "@workspace/validation";

type PhoneInputProps = Omit<ComponentProps<typeof Input>, "type" | "value" | "onChange"> & {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  onErrorChange?: (error: string | null) => void;
  required?: boolean;
  optional?: boolean;
  /** Mobile = 10-digit Indian; contact = branch/landline (7–15 digits). */
  mode?: "mobile" | "contact";
  hint?: string;
  /** Light label/hint colors for dark backgrounds (auth pages). */
  dark?: boolean;
};

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(function PhoneInput(
  {
    label,
    value,
    onChange,
    error,
    onErrorChange,
    required = true,
    optional = false,
    mode = "mobile",
    hint,
    dark = false,
    className,
    id,
    ...props
  },
  ref,
) {
  const validate = (raw: string) => {
    if (mode === "contact") {
      return validateContactPhone(raw, { required: required && !optional });
    }
    return validateIndianMobile(raw, { required: required && !optional });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(sanitizePhoneInput(e.target.value));
    if (error && onErrorChange) onErrorChange(null);
  };

  const handleBlur = () => {
    if (!onErrorChange) return;
    const result = validate(value);
    onErrorChange(result.ok ? null : result.error);
  };

  const defaultHint =
    mode === "contact"
      ? "7–15 digit phone number"
      : "10-digit Indian mobile (e.g. 9876543210)";

  return (
    <div>
      {label && (
        <Label htmlFor={id} className={cn("text-sm", dark && "text-white/70")}>
          {label}
        </Label>
      )}
      <Input
        ref={ref}
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        aria-invalid={!!error}
        className={cn(label && "mt-1", error && "border-destructive focus-visible:ring-destructive", className)}
        placeholder={mode === "contact" ? "05422500001" : "9876543210"}
        {...props}
      />
      {error ? (
        <p className="text-destructive text-xs mt-1" role="alert">
          {error}
        </p>
      ) : (
        <p className={cn("text-xs mt-1", dark ? "text-white/40" : "text-muted-foreground")}>
          {hint ?? defaultHint}
        </p>
      )}
    </div>
  );
});

export function validatePhoneValue(
  value: string,
  { required = true, optional = false, mode = "mobile" }: { required?: boolean; optional?: boolean; mode?: "mobile" | "contact" } = {},
): string | null {
  const result =
    mode === "contact"
      ? validateContactPhone(value, { required: required && !optional })
      : validateIndianMobile(value, { required: required && !optional });
  return result.ok ? null : result.error;
}

export { PHONE_ERRORS };
