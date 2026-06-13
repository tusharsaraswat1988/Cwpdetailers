/** Supported template variable placeholders */
export const TEMPLATE_VARIABLES = [
  "customer_name", "vehicle_number", "amount_due", "invoice_number",
  "package_name", "next_service_date",
] as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];

const PLACEHOLDER_RE = /\{\{(\w+)\}\}/g;

export function extractVariables(body: string): string[] {
  const found = new Set<string>();
  for (const m of body.matchAll(PLACEHOLDER_RE)) found.add(m[1]!);
  return [...found];
}

export function renderTemplate(
  body: string,
  vars: Record<string, string | number | null | undefined>,
): string {
  return body.replace(PLACEHOLDER_RE, (_, key: string) => {
    const val = vars[key];
    return val != null ? String(val) : `{{${key}}}`;
  });
}

export type RecipientContext = {
  customerId?: number | null;
  leadId?: number | null;
  customerName?: string | null;
  phone?: string | null;
  email?: string | null;
  userId?: number | null;
  vehicleNumber?: string | null;
  amountDue?: string | null;
  invoiceNumber?: string | null;
  packageName?: string | null;
  nextServiceDate?: string | null;
};

export function contextToVars(ctx: RecipientContext): Record<string, string> {
  return {
    customer_name: ctx.customerName ?? "Customer",
    vehicle_number: ctx.vehicleNumber ?? "",
    amount_due: ctx.amountDue ?? "0",
    invoice_number: ctx.invoiceNumber ?? "",
    package_name: ctx.packageName ?? "",
    next_service_date: ctx.nextServiceDate ?? "",
  };
}
