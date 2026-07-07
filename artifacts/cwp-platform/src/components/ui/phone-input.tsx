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
import { formatIndianMobileDisplay, stripIndianMobileDigits } from "@/lib/phoneDisplay";

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
  /** Hide helper text below the field. */
  hideHint?: boolean;
  /** Fixed +91 prefix with spaced display (98765 43210). Value remains 10 digits. */
  indianMobile?: boolean;
  /** Validate only once 10 digits are entered or on blur/submit — not while typing partial numbers. */
  deferValidationUntilComplete?: boolean;
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
    hideHint = false,
    indianMobile = false,
    deferValidationUntilComplete = false,
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
    const next = indianMobile
      ? stripIndianMobileDigits(e.target.value)
      : sanitizePhoneInput(e.target.value);
    onChange(next);
    if (error && onErrorChange) onErrorChange(null);
    if (deferValidationUntilComplete && indianMobile && onErrorChange && next.length === 10) {
      const result = validate(next);
      onErrorChange(result.ok ? null : result.error);
    }
  };

  const handleBlur = () => {
    if (!onErrorChange) return;
    if (deferValidationUntilComplete && indianMobile) {
      const digitCount = value.replace(/\D/g, "").length;
      if (digitCount > 0 && digitCount < 10) return;
    }
    const result = validate(value);
    onErrorChange(result.ok ? null : result.error);
  };

  const defaultHint =
    mode === "contact"
      ? "7–15 digit phone number"
      : "10-digit Indian mobile (e.g. 9876543210)";

  const displayValue = indianMobile ? formatIndianMobileDisplay(value) : value;
  const showHint = !hideHint && !error && !(indianMobile && !hint);

  const inputEl = (
    <Input
      ref={ref}
      id={id}
      type="tel"
      inputMode="numeric"
      autoComplete="tel"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      aria-invalid={!!error}
      className={cn(
        !indianMobile && label && "mt-1.5",
        indianMobile && "rounded-l-none border-l-0 pl-3 flex-1 min-w-0 rounded-r-lg",
        error && "border-destructive focus-visible:ring-destructive/50",
        className,
      )}
      placeholder={indianMobile ? "98765 43210" : mode === "contact" ? "05422500001" : "9876543210"}
      {...props}
    />
  );

  return (
    <div>
      {label && (
        <Label htmlFor={id} className={cn("text-sm font-normal", dark && "text-white/70")}>
          {label}
        </Label>
      )}
      {indianMobile ? (
        <div className={cn("flex", label && "mt-1.5")}>
          <span
            className={cn(
              "inline-flex items-center h-12 min-h-12 px-3 rounded-l-lg border border-r-0 text-sm font-medium tabular-nums shrink-0 transition-colors duration-200",
              dark
                ? "bg-white/[0.04] border-white/10 text-white/60"
                : "bg-muted border-input text-muted-foreground",
              error && "border-destructive",
            )}
            aria-hidden
          >
            +91
          </span>
          {inputEl}
        </div>
      ) : (
        inputEl
      )}
      {error ? (
        <p className="text-destructive text-xs mt-1" role="alert">
          {error}
        </p>
      ) : showHint ? (
        <p className={cn("text-xs mt-1", dark ? "text-white/40" : "text-muted-foreground")}>
          {hint ?? defaultHint}
        </p>
      ) : null}
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
