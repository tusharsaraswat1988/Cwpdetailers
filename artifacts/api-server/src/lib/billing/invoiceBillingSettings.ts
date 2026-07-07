import { db, businessInfoTable, catalogSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getInvoiceBranding } from "../brandIdentityService";

export type InvoiceBillingSettings = {
  companyName: string;
  address: string;
  gstNumber: string | null;
  panNumber: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  pdfLogoUrl: string | null;
  defaultSac: string;
  bankAccountName: string;
  bankName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  upiId: string;
  signatureUrl: string | null;
  placeOfSupply: string;
  terms: string[];
};

const DEFAULT_TERMS_TEMPLATE = [
  "Membership packages sold under this Tax Invoice are non-transferable to any other individual or vehicle.",
  "This Invoice cannot be considered as receipt; a separate receipt will be issued upon receiving the payment.",
  "Any legal disputes are subject to the Varanasi jurisdiction only.",
  "All service package validity are to be considered from the date of invoice.",
  "All prices on this invoice are GST-inclusive (18%) unless marked as complimentary.",
  "Payment of full amount due to {company} is required as per agreed terms.",
  "{company} will not be liable for any illegal and unethical usage of the vehicle after service.",
  "This Invoice shall be valid for 15 days and the booking only confirmed when payment is received.",
];

const DEFAULT_ADDRESS =
  "0, Near Ishita School Seer Goverdhanpur, Varanasi, Uttar Pradesh, 221011";

const DEFAULTS: Omit<InvoiceBillingSettings, "companyName" | "address" | "gstNumber" | "phone" | "email" | "website" | "pdfLogoUrl"> = {
  panNumber: "BYWPS9468R",
  defaultSac: "998533",
  bankAccountName: "CWP DETAILERS AND MOTORS",
  bankName: "State Bank of India, BHELUPURA",
  bankAccountNumber: "42105505194",
  bankIfsc: "SBIN0001773",
  upiId: "pinelabs.stq4501838@pineaxis",
  signatureUrl: null,
  placeOfSupply: "Uttar Pradesh",
  terms: DEFAULT_TERMS_TEMPLATE,
};

function panFromGstin(gstin: string | null | undefined): string | null {
  if (!gstin || gstin.length < 12) return null;
  return gstin.slice(2, 12).toUpperCase();
}

function formatPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  return phone.replace(/^(\+91[- ]?)/, "").replace(/[- ]/g, "");
}

function formatBusinessAddress(biz: typeof businessInfoTable.$inferSelect | undefined): string {
  if (!biz) return DEFAULT_ADDRESS;
  const parts = [
    biz.addressLine1,
    biz.addressLine2,
    [biz.city, biz.state, biz.pinCode].filter(Boolean).join(", "),
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : DEFAULT_ADDRESS;
}

export async function getInvoiceBillingSettings(): Promise<InvoiceBillingSettings> {
  const [brand, bizRows, settingsRow] = await Promise.all([
    getInvoiceBranding(),
    db.select().from(businessInfoTable).where(eq(businessInfoTable.id, 1)).limit(1),
    db.select().from(catalogSettingsTable).where(eq(catalogSettingsTable.key, "invoice_billing")).limit(1),
  ]);

  const biz = bizRows[0];
  const override = (settingsRow[0]?.value ?? {}) as Partial<InvoiceBillingSettings>;
  const gstNumber = override.gstNumber ?? brand.gstNumber ?? biz?.gstNumber ?? "09BYWPS9468R3ZG";

  const companyName = override.companyName ?? brand.companyName ?? biz?.businessName ?? brand.brandName ?? "";
  const termsTemplate = override.terms?.length ? override.terms : DEFAULT_TERMS_TEMPLATE.map(
    t => t.replace(/\{company\}/g, companyName),
  );

  return {
    companyName,
    address: override.address ?? brand.address ?? formatBusinessAddress(biz),
    gstNumber,
    panNumber: override.panNumber ?? panFromGstin(gstNumber) ?? DEFAULTS.panNumber,
    phone: formatPhone(override.phone ?? brand.supportPhone ?? biz?.supportPhone) ?? "7054007733",
    email: override.email ?? brand.supportEmail ?? biz?.supportEmail ?? "cwpdetailers@gmail.com",
    website: override.website ?? biz?.website ?? "www.cwpdetailers.in",
    pdfLogoUrl: override.pdfLogoUrl ?? brand.pdfLogoUrl ?? null,
    defaultSac: override.defaultSac ?? DEFAULTS.defaultSac,
    bankAccountName: override.bankAccountName ?? DEFAULTS.bankAccountName,
    bankName: override.bankName ?? DEFAULTS.bankName,
    bankAccountNumber: override.bankAccountNumber ?? DEFAULTS.bankAccountNumber,
    bankIfsc: override.bankIfsc ?? DEFAULTS.bankIfsc,
    upiId: override.upiId ?? DEFAULTS.upiId,
    signatureUrl: override.signatureUrl ?? DEFAULTS.signatureUrl,
    placeOfSupply: override.placeOfSupply ?? biz?.state ?? DEFAULTS.placeOfSupply,
    terms: termsTemplate,
  };
}

const SERVICE_CATEGORY_TERMS: Record<string, string[]> = {
  dcms: [
    "Daily cleaning membership is vehicle-specific and non-transferable.",
    "Missed days due to customer unavailability are not refundable unless covered under plan terms.",
    "Plan validity starts from the invoice date unless otherwise agreed in writing.",
  ],
  package: [
    "Wash credits / package visits must be used within validity period shown on the plan.",
    "Unused visits expire as per package policy and are not refundable.",
  ],
  solar: [
    "Solar AMC covers scheduled maintenance visits only; breakdown repairs may be billed separately.",
    "Site access and safety clearance at customer premises is the customer's responsibility.",
  ],
  detailing: [
    "Ceramic / PPF / coating warranty is as per manufacturer and CWP workmanship policy.",
    "Customer must inspect vehicle at delivery; post-delivery complaints may not be entertained.",
  ],
  service: [
    "One-time service warranty is limited to workmanship for 24 hours from completion.",
  ],
  general: [],
};

export async function getTermsForCategories(categories: string[]): Promise<string[]> {
  const settings = await getInvoiceBillingSettings();
  const merged = new Set<string>(settings.terms);
  for (const cat of categories) {
    for (const t of SERVICE_CATEGORY_TERMS[cat] ?? []) merged.add(t);
  }
  return [...merged];
}

export async function getInvoiceBillingSettingsForAdmin() {
  return getInvoiceBillingSettings();
}

const SETTINGS_KEY = "invoice_billing";

export type InvoiceBillingSettingsPatch = Partial<Omit<InvoiceBillingSettings, "pdfLogoUrl">> & {
  pdfLogoUrl?: string | null;
};

export async function saveInvoiceBillingSettings(patch: InvoiceBillingSettingsPatch): Promise<InvoiceBillingSettings> {
  const current = await getInvoiceBillingSettings();
  const stored: InvoiceBillingSettingsPatch = {
    companyName: patch.companyName ?? current.companyName,
    address: patch.address ?? current.address,
    gstNumber: patch.gstNumber ?? current.gstNumber,
    panNumber: patch.panNumber ?? current.panNumber,
    phone: patch.phone ?? current.phone,
    email: patch.email ?? current.email,
    website: patch.website ?? current.website,
    pdfLogoUrl: patch.pdfLogoUrl !== undefined ? patch.pdfLogoUrl : current.pdfLogoUrl,
    defaultSac: patch.defaultSac ?? current.defaultSac,
    bankAccountName: patch.bankAccountName ?? current.bankAccountName,
    bankName: patch.bankName ?? current.bankName,
    bankAccountNumber: patch.bankAccountNumber ?? current.bankAccountNumber,
    bankIfsc: patch.bankIfsc ?? current.bankIfsc,
    upiId: patch.upiId ?? current.upiId,
    signatureUrl: patch.signatureUrl !== undefined ? patch.signatureUrl : current.signatureUrl,
    placeOfSupply: patch.placeOfSupply ?? current.placeOfSupply,
    terms: patch.terms?.length ? patch.terms : current.terms,
  };

  await db.insert(catalogSettingsTable).values({ key: SETTINGS_KEY, value: stored })
    .onConflictDoUpdate({
      target: catalogSettingsTable.key,
      set: { value: stored, updatedAt: new Date() },
    });

  return getInvoiceBillingSettings();
}

export function getServiceCategoryTermsPreview() {
  return SERVICE_CATEGORY_TERMS;
}
