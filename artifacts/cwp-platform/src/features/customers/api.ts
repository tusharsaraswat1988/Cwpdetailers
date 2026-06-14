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
  existingStaffId?: number;
  existingStaffName?: string;
  existingUserId?: number;
  existingUserName?: string;
  conflict?: {
    field: "phone" | "email";
    entity: "customer" | "staff" | "user";
    entityId: number;
    entityName: string;
  };
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
  return res.json() as Promise<{ data: Array<{ id: number; invoiceNumber?: string; totalAmount?: string | number; balanceDue?: string | number; status?: string; issuedAt?: string }>; total: number }>;
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

export type CustomerServicesHub = {
  customerId: number;
  profile: import("@workspace/customer-model").CustomerProfile;
  counts: {
    dailyCleaning: number;
    entitlements: number;
    legacySubscriptions: number;
    solarSites: number;
    activeContracts: number;
  };
  dailyCleaning: Array<{
    id: number;
    vehicleId: number;
    vehicleLabel: string;
    planName: string;
    status: string;
    startDate: string;
    remainingCleanings: number;
    remainingWashes: number;
    allocatedCleanings: number;
    allocatedWashes: number;
    assignedStaffName: string | null;
    renewalEligible: boolean;
    bundledAddons: string[];
  }>;
  entitlements: Array<{
    id: number;
    entitlementType: string;
    serviceName: string | null;
    packageName: string | null;
    remainingCredits: number;
    totalCredits: number;
    validFrom: string;
    validUntil: string;
    status: string;
  }>;
  legacySubscriptions: Array<{
    id: number;
    type: string;
    status: string;
    serviceName: string | null;
    vehicleId: number | null;
    solarSiteId: number | null;
    startDate: string;
    endDate: string;
    servicesRemaining: number | null;
    totalServices: number | null;
    nextDueDate: string | null;
  }>;
  solarSites: Array<{
    id: number;
    address: string;
    panelCount: number;
    lastCleanedDate: string | null;
    nextServiceDate: string | null;
    locationLabel: string | null;
    completedBookings: number;
    activeAmcEntitlements: number;
  }>;
  recentWork: Array<{
    id: string;
    source: "dcms_visit" | "booking" | "entitlement";
    workType: string;
    assetLabel: string | null;
    status: string;
    occurredAt: string;
    staffName: string | null;
    addonLabel: string | null;
  }>;
  contracts: Array<{
    id: number;
    productLine: string;
    sourceSystem: string;
    sourceId: number;
    status: string;
    assetType: string | null;
    assetId: number | null;
    assetLabel: string | null;
    validFrom: string | null;
    validUntil: string | null;
    startDate: string | null;
    endDate: string | null;
    serviceName: string;
    serviceLocationId: number | null;
    serviceLocationLabel: string | null;
    linkedAssetId: number | null;
    linkedAssetLabel: string | null;
    summary: Record<string, unknown>;
  }>;
};

export type CustomerBillingSummary = {
  customerId: number;
  outstandingDue: number;
  walletBalance: number;
  lastInvoice: {
    id: number;
    invoiceNumber: string;
    totalAmount: number;
    balanceDue: number;
    status: string;
    issuedAt: string | null;
  } | null;
  lastPayment: {
    id: number;
    amount: number;
    method: string;
    receivedAt: string | null;
  } | null;
};

export async function fetchCustomerBillingSummary(customerId: number): Promise<CustomerBillingSummary> {
  const res = await fetch(`/api/customers/${customerId}/billing-summary`, { credentials: "include" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to load billing summary");
  }
  return res.json();
}

export async function fetchCustomerServicesHub(customerId: number): Promise<CustomerServicesHub> {
  const res = await fetch(`/api/customers/${customerId}/services`, { credentials: "include" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to load services");
  }
  return res.json();
}

export async function grantCustomerPackage(
  customerId: number,
  packageId: number,
  opts?: { vehicleId?: number; solarSiteId?: number },
) {
  const res = await fetch("/api/catalog/entitlements/grant-package", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customerId, packageId, ...opts }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to grant package");
  }
  return res.json();
}

export async function createCustomerSolarSite(data: {
  customerId: number;
  address: string;
  panelCount: number;
  serviceLat?: number;
  serviceLng?: number;
  placeId?: string;
  locationLabel?: string;
}) {
  const res = await fetch("/api/solar-sites", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to add solar site");
  }
  return res.json();
}

export async function createCustomerBooking(data: {
  customerId: number;
  vehicleId?: number;
  solarSiteId?: number;
  serviceId?: number;
  staffId?: number;
  scheduledDate: string;
  scheduledTime: string;
  serviceType: string;
  address: string;
  locationLat: number;
  locationLng: number;
  placeId?: string;
  addonIds?: number[];
  notes?: string;
  citySlug?: string;
}) {
  const res = await fetch("/api/bookings", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to create booking");
  }
  return res.json();
}
