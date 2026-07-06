import { type ReactNode, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

export type ResourceFormField<T> = {
  key: keyof T & string;
  label: string;
  type?: "text" | "email" | "tel" | "number" | "password" | "date";
  placeholder?: string;
  required?: boolean;
  /** Render a custom control instead of an `<Input>` for this field. */
  render?: (value: T[keyof T & string], onChange: (next: T[keyof T & string]) => void) => ReactNode;
};

export type ResourceFormProps<T extends Record<string, unknown>> = {
  fields: ResourceFormField<T>[];
  value: T;
  onChange: (next: T) => void;
  onSubmit: () => void;
  submitLabel: string;
  isSubmitting?: boolean;
  testIdPrefix?: string;
  disabled?: boolean;
};

/**
 * A typed, reusable dialog/inline form for creating or editing a resource.
 * Pages should describe their fields declaratively instead of repeating the
 * label/input/state plumbing — that pattern was the source of the recently
 * removed `(form as any)[k]` casts.
 *
 * Usage:
 *
 *   const [form, setForm] = useState<CustomerForm>({...});
 *   <ResourceForm
 *     fields={[{ key: "name", label: "Full Name", required: true }, ...]}
 *     value={form}
 *     onChange={setForm}
 *     onSubmit={() => createMutation.mutate({ data: form })}
 *     submitLabel="Create Customer"
 *     isSubmitting={createMutation.isPending}
 *     testIdPrefix="input-customer"
 *   />
 */
export function ResourceForm<T extends Record<string, unknown>>(props: ResourceFormProps<T>) {
  const { fields, value, onChange, onSubmit, submitLabel, isSubmitting, testIdPrefix, disabled } = props;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isSubmitting && !disabled) onSubmit();
  };

  return (
    <form className="space-y-4 mt-2" onSubmit={handleSubmit} data-testid={testIdPrefix ? `${testIdPrefix}-form` : undefined}>
      {fields.map(f => (
        <div key={f.key}>
          <Label htmlFor={f.key}>{f.label}{f.required && <span className="text-red-400 ml-0.5">*</span>}</Label>
          {f.render
            ? f.render(value[f.key] as T[keyof T & string], next => onChange({ ...value, [f.key]: next }))
            : f.type === "password"
              ? (
                <PasswordInput
                  id={f.key}
                  data-testid={testIdPrefix ? `${testIdPrefix}-${f.key}` : undefined}
                  placeholder={f.placeholder}
                  required={f.required}
                  value={(value[f.key] as string | undefined) ?? ""}
                  onChange={e => onChange({ ...value, [f.key]: e.target.value } as T)}
                  containerClassName="mt-1"
                />
              )
              : (
              <Input
                id={f.key}
                data-testid={testIdPrefix ? `${testIdPrefix}-${f.key}` : undefined}
                type={f.type ?? "text"}
                placeholder={f.placeholder}
                required={f.required}
                value={(value[f.key] as string | number | undefined) ?? ""}
                onChange={e => onChange({ ...value, [f.key]: e.target.value } as T)}
                className="mt-1"
              />
            )}
        </div>
      ))}
      <Button
        type="submit"
        disabled={isSubmitting || disabled}
        className="w-full bg-primary text-secondary hover:bg-primary/90"
        data-testid={testIdPrefix ? `${testIdPrefix}-submit` : undefined}
      >
        {isSubmitting ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}

export default ResourceForm;
