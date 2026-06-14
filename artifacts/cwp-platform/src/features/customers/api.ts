export type CreateCustomerPayload = {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  branchId?: number;
  password?: string;
  gstin?: string | null;
  billingName?: string | null;
};

export type CreateCustomerResult = {
  id: number;
  name: string;
  phone: string;
  loginCreated?: boolean;
  loginWarning?: string;
};

export type CreateCustomerError = {
  error: string;
  existingCustomerId?: number;
  existingCustomerName?: string;
};

export async function createCustomerRequest(payload: CreateCustomerPayload): Promise<{
  ok: true;
  data: CreateCustomerResult;
} | {
  ok: false;
  status: number;
  body: CreateCustomerError;
}> {
  const res = await fetch("/api/customers", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, status: res.status, body: body as CreateCustomerError };
  }
  return { ok: true, data: body as CreateCustomerResult };
}

export async function creditCustomerWallet(customerId: number, body: {
  amount: number;
  paymentMode: string;
  notes?: string;
}) {
  const res = await fetch(`/api/customers/${customerId}/wallet/credit`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Wallet credit failed");
  }
  return res.json();
}

export async function previewCustomerMigration(file: File) {
  const res = await fetch("/api/migration/customers/preview", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "X-Filename": file.name,
    },
    body: file,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Preview failed");
  return body;
}

export async function importCustomerMigration(file: File, dryRun: boolean) {
  const res = await fetch(`/api/migration/customers/import?dryRun=${dryRun ? "true" : "false"}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "X-Filename": file.name,
    },
    body: file,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Import failed");
  return body;
}

export type CustomerNetworkPerson = {
  id: number;
  name: string;
  phone: string;
  city?: string | null;
  status?: string;
};

export type CustomerNetwork = {
  referrer: CustomerNetworkPerson | null;
  referrals: CustomerNetworkPerson[];
  siblings: CustomerNetworkPerson[];
  referralCount: number;
};

export async function fetchCustomerNetwork(customerId: number): Promise<CustomerNetwork> {
  const res = await fetch(`/api/customers/${customerId}/network`, { credentials: "include" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to load customer network");
  }
  return res.json();
}

export async function searchCustomers(q: string) {
  const res = await fetch(`/api/customers?search=${encodeURIComponent(q)}&limit=10`, { credentials: "include" });
  if (!res.ok) return [];
  const body = await res.json();
  return (body.data ?? []) as Array<{ id: number; name: string; phone: string }>;
}

export async function updateCustomerTier3Fields(customerId: number, fields: {
  gstin?: string | null;
  billingName?: string | null;
  referredByCustomerId?: number | null;
}) {
  const res = await fetch(`/api/customers/${customerId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Update failed");
  }
  return res.json();
}

export async function fetchCustomerComplaints(customerId: number) {
  const res = await fetch(`/api/complaints?customerId=${customerId}&limit=20`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load complaints");
  return res.json() as Promise<{ data: unknown[]; total: number }>;
}

export async function fetchCustomerSubscriptions(customerId: number) {
  const res = await fetch(`/api/subscriptions?customerId=${customerId}&limit=10`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load subscriptions");
  return res.json() as Promise<{ data: Array<{ id: number; type?: string; status?: string; price?: string | number; startDate?: string; endDate?: string }>; total: number }>;
}

export async function fetchCustomerInvoices(customerId: number) {
  const res = await fetch(`/api/invoices?customerId=${customerId}&limit=10`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load invoices");
  return res.json() as Promise<{ data: Array<{ id: number; invoiceNumber?: string; totalAmount?: string | number; status?: string; issuedAt?: string }>; total: number }>;
}

export function migrationSampleDownloadUrl() {
  return "/api/migration/customers/sample";
}

export type LegacyContactRow = {
  id: number;
  name: string;
  phone: string;
  city?: string | null;
  customerSince?: string | null;
  operationalNotes?: string | null;
  createdAt: string;
};

export async function fetchLegacyContacts(params?: { limit?: number; offset?: number }) {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  const res = await fetch(`/api/customers/legacy-contacts?${qs}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load legacy contacts");
  return res.json() as Promise<{ data: LegacyContactRow[]; total: number; reactivatedTotal: number }>;
}

export async function fetchReactivatedCustomers(params?: { limit?: number; offset?: number; days?: number }) {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  if (params?.days) qs.set("days", String(params.days));
  const res = await fetch(`/api/customers/reactivated?${qs}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load reactivated customers");
  return res.json() as Promise<{ data: Array<LegacyContactRow & { reactivatedAt: string }>; total: number }>;
}

export async function reactivateLegacyCustomer(customerId: number) {
  const res = await fetch(`/api/customers/${customerId}/reactivate`, {
    method: "POST",
    credentials: "include",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Reactivation failed");
  return body;
}
