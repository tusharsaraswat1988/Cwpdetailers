import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { authInputClass, authLabelClass } from "@/components/auth/authStyles";
import { cn } from "@/lib/utils";

export const MIN_PASSWORD_LENGTH = 6;

export function validateCreatePassword(
  password: string,
  confirmPassword: string,
): { ok: true } | { ok: false; error: string } {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }
  if (password !== confirmPassword) {
    return { ok: false, error: "Passwords do not match" };
  }
  return { ok: true };
}

type CreatePasswordFieldsProps = {
  password: string;
  confirmPassword: string;
  onPasswordChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
  disabled?: boolean;
  dark?: boolean;
  idPrefix?: string;
  hint?: string;
  className?: string;
};

/** Password + confirm fields for signup / Google complete. */
export function CreatePasswordFields({
  password,
  confirmPassword,
  onPasswordChange,
  onConfirmChange,
  disabled,
  dark = true,
  idPrefix = "create-password",
  hint = "At least 6 characters. Use this to sign in next time without SMS.",
  className,
}: CreatePasswordFieldsProps) {
  const labelClass = dark ? authLabelClass : undefined;
  const inputClass = dark ? authInputClass : undefined;

  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <Label htmlFor={`${idPrefix}-password`} className={labelClass}>
          Create password
        </Label>
        <PasswordInput
          id={`${idPrefix}-password`}
          data-testid={`${idPrefix}-password`}
          value={password}
          onChange={e => onPasswordChange(e.target.value)}
          placeholder="Create a password"
          autoComplete="new-password"
          disabled={disabled}
          containerClassName="mt-1.5"
          className={inputClass}
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-confirm`} className={labelClass}>
          Confirm password
        </Label>
        <PasswordInput
          id={`${idPrefix}-confirm`}
          data-testid={`${idPrefix}-confirm`}
          value={confirmPassword}
          onChange={e => onConfirmChange(e.target.value)}
          placeholder="Re-enter password"
          autoComplete="new-password"
          disabled={disabled}
          containerClassName="mt-1.5"
          className={inputClass}
        />
        {hint ? (
          <p className={cn("text-xs mt-1.5", dark ? "text-white/30" : "text-muted-foreground")}>
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
