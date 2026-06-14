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
