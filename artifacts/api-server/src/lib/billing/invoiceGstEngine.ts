import type { InvoiceHsnSummaryRow, InvoiceItem } from "@workspace/db";

export const DEFAULT_SAC = "998533";
export const DEFAULT_GST_RATE = 18;
export const SUPPLIER_STATE_CODE = "09"; // Uttar Pradesh (CWP GSTIN)

export const INDIAN_STATE_CODES: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
  "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan",
  "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh",
  "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura",
  "17": "Meghalaya", "18": "Assam", "19": "West Bengal", "20": "Jharkhand",
  "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "26": "Dadra & Nagar Haveli and Daman & Diu", "27": "Maharashtra", "29": "Karnataka",
  "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu",
  "34": "Puducherry", "35": "Andaman & Nicobar", "36": "Telangana", "37": "Andhra Pradesh",
  "38": "Ladakh",
};

export function stateCodeFromGstin(gstin: string | null | undefined): string {
  if (!gstin || gstin.length < 2) return SUPPLIER_STATE_CODE;
  return gstin.slice(0, 2);
}

export function stateNameFromCode(code: string): string {
  return INDIAN_STATE_CODES[code] ?? "Uttar Pradesh";
}

export function resolvePlaceOfSupply(params: {
  customerState?: string | null;
  customerGstin?: string | null;
  explicit?: string | null;
}): { placeOfSupply: string; supplyStateCode: string; isInterState: boolean } {
  const supplyStateCode = params.customerGstin
    ? stateCodeFromGstin(params.customerGstin)
    : SUPPLIER_STATE_CODE;
  const placeOfSupply = params.explicit?.trim()
    || params.customerState?.trim()
    || stateNameFromCode(supplyStateCode);
  const isInterState = supplyStateCode !== SUPPLIER_STATE_CODE;
  return { placeOfSupply, supplyStateCode, isInterState };
}

export type GstComputationInput = {
  items: InvoiceItem[];
  invoiceDiscount?: number;
  gstInclusive?: boolean;
  isInterState?: boolean;
  defaultSac?: string;
};

export type GstComputationResult = {
  items: InvoiceItem[];
  subtotal: number;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  discount: number;
  roundOff: number;
  totalAmount: number;
  hsnSummary: InvoiceHsnSummaryRow[];
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function sacForItem(item: InvoiceItem, defaultSac: string) {
  return item.sac ?? item.hsn ?? defaultSac;
}

export function computeInvoiceGst(input: GstComputationInput): GstComputationResult {
  const defaultSac = input.defaultSac ?? DEFAULT_SAC;
  const invoiceDiscount = input.invoiceDiscount ?? 0;
  const gstInclusive = input.gstInclusive !== false;
  const isInterState = input.isInterState ?? false;

  const grossLines = input.items.map(item => {
    const qty = item.quantity || 0;
    const rate = item.unitPrice || 0;
    return qty * rate;
  });
  const grossTotal = grossLines.reduce((s, v) => s + v, 0) || 1;

  const computedItems: InvoiceItem[] = input.items.map((item, idx) => {
    const qty = item.quantity || 0;
    const rate = item.unitPrice || 0;
    const gstRate = item.gstRate ?? DEFAULT_GST_RATE;
    const sac = sacForItem(item, defaultSac);
    const gross = qty * rate;
    const lineDisc = item.isComplimentary
      ? gross
      : (item.lineDiscount ?? (invoiceDiscount * (gross / grossTotal)));

    if (item.isComplimentary) {
      return {
        ...item,
        sac,
        gstRate,
        lineDiscount: gross,
        taxableValue: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        total: 0,
      };
    }

    const netInclusive = Math.max(0, gross - lineDisc);
    let taxableValue = netInclusive;
    let total = netInclusive;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (gstInclusive && netInclusive > 0) {
      taxableValue = round2(netInclusive / (1 + gstRate / 100));
      const tax = round2(netInclusive - taxableValue);
      total = netInclusive;
      if (isInterState) {
        igst = tax;
      } else {
        cgst = round2(tax / 2);
        sgst = round2(tax - cgst);
      }
    } else if (!gstInclusive && netInclusive > 0) {
      taxableValue = netInclusive;
      const tax = round2(taxableValue * (gstRate / 100));
      total = round2(taxableValue + tax);
      if (isInterState) {
        igst = tax;
      } else {
        cgst = round2(tax / 2);
        sgst = round2(tax - cgst);
      }
    }

    return {
      ...item,
      sac,
      gstRate,
      lineDiscount: round2(lineDisc),
      taxableValue,
      cgst,
      sgst,
      igst,
      total,
    };
  });

  const subtotal = round2(computedItems.reduce((s, i) => s + (i.taxableValue ?? 0), 0));
  const cgstAmount = round2(computedItems.reduce((s, i) => s + (i.cgst ?? 0), 0));
  const sgstAmount = round2(computedItems.reduce((s, i) => s + (i.sgst ?? 0), 0));
  const igstAmount = round2(computedItems.reduce((s, i) => s + (i.igst ?? 0), 0));
  const gstAmount = round2(cgstAmount + sgstAmount + igstAmount);
  const rawTotal = round2(computedItems.reduce((s, i) => s + i.total, 0));
  const totalAmount = Math.round(rawTotal);
  const roundOff = round2(totalAmount - rawTotal);

  const summaryMap = new Map<string, InvoiceHsnSummaryRow>();
  for (const item of computedItems) {
    const key = sacForItem(item, defaultSac);
    const taxable = item.taxableValue ?? 0;
    if (taxable <= 0 && !(item.isComplimentary)) continue;
    const rate = item.gstRate ?? DEFAULT_GST_RATE;
    const half = rate / 2;
    const row = summaryMap.get(key) ?? {
      sacOrHsn: key,
      taxableValue: 0,
      cgstRate: isInterState ? 0 : half,
      cgstAmount: 0,
      sgstRate: isInterState ? 0 : half,
      sgstAmount: 0,
      igstRate: isInterState ? rate : 0,
      igstAmount: 0,
      totalTax: 0,
    };
    row.taxableValue = round2(row.taxableValue + taxable);
    row.cgstAmount = round2(row.cgstAmount + (item.cgst ?? 0));
    row.sgstAmount = round2(row.sgstAmount + (item.sgst ?? 0));
    row.igstAmount = round2(row.igstAmount + (item.igst ?? 0));
    row.totalTax = round2(row.cgstAmount + row.sgstAmount + row.igstAmount);
    summaryMap.set(key, row);
  }

  return {
    items: computedItems,
    subtotal,
    gstAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    discount: round2(invoiceDiscount),
    roundOff,
    totalAmount,
    hsnSummary: [...summaryMap.values()],
  };
}

export function financialYearLabel(d = new Date()): string {
  const month = d.getMonth();
  const year = d.getFullYear();
  const start = month >= 3 ? year : year - 1;
  return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
}
