import PDFDocument from "pdfkit";
import type { InvoiceHsnSummaryRow, InvoiceItem } from "@workspace/db";
import type { InvoiceBillingSettings } from "./invoiceBillingSettings";

export type InvoicePdfInput = {
  invoiceNumber: string;
  documentType: "tax_invoice" | "credit_note" | "debit_note";
  referenceInvoiceNumber?: string | null;
  referenceInvoiceDate?: string | null;
  creditReason?: string | null;
  customerName: string;
  customerPhone: string | null;
  customerEmail?: string | null;
  customerAddress?: string | null;
  customerCity?: string | null;
  customerGstin: string | null;
  placeOfSupply: string;
  supplyStateCode: string;
  isInterState: boolean;
  items: InvoiceItem[];
  subtotal: number;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  roundOff: number;
  hsnSummary: InvoiceHsnSummaryRow[];
  discount: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  dueDate: string | null;
  issuedAt: Date | null;
  notes?: string | null;
  terms?: string[];
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 28;
const CONTENT_W = PAGE_W - MARGIN * 2;
const GREY = "#E0E0E0";
const BORDER = "#222222";
const RIGHT_X = 352;
const RIGHT_W = PAGE_W - MARGIN - RIGHT_X;
const LOGO_SIZE = 46;

const COL = {
  sno: MARGIN + 4,
  service: MARGIN + 30,
  sac: MARGIN + 172,
  qty: MARGIN + 214,
  rate: MARGIN + 256,
  disc: MARGIN + 304,
  tax: MARGIN + 354,
  amount: MARGIN + 404,
};

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "-";
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "-";
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function fmtInr(n: number, symbol = false): string {
  const rounded = Math.round(n * 100) / 100;
  const formatted = rounded.toLocaleString("en-IN", { maximumFractionDigits: 0, minimumFractionDigits: 0 });
  return symbol ? `\u20b9 ${formatted}` : formatted;
}

function twoDigits(n: number): string {
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  if (n < 20) return ones[n] ?? "";
  return `${tens[Math.floor(n / 10)] ?? ""}${n % 10 ? ` ${ones[n % 10]}` : ""}`.trim();
}

function amountInWords(amount: number): string {
  const num = Math.round(amount);
  if (num === 0) return "Zero Rupees";
  const parts: string[] = [];
  let n = num;
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const hundred = Math.floor(n / 100);
  n %= 100;
  if (crore) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) parts.push(`${twoDigits(hundred)} Hundred`);
  if (n) parts.push(twoDigits(n));
  return `${parts.join(" ")} Rupees`;
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    let fetchUrl = url;
    if (/\.(svg|webp)(\?|$)/i.test(url) && url.includes("res.cloudinary.com")) {
      fetchUrl = url.replace("/upload/", "/upload/f_png,q_auto/");
    }
    const res = await fetch(fetchUrl);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("svg") || ct.includes("webp")) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function fetchQrBuffer(upiId: string, amount: number): Promise<Buffer | null> {
  const upi = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=CWP%20DETAILERS&cu=INR&am=${amount.toFixed(2)}`;
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(upi)}`;
  return fetchImageBuffer(url);
}

function drawPageBorder(doc: InstanceType<typeof PDFDocument>) {
  doc.save().lineWidth(0.75).strokeColor(BORDER).rect(MARGIN, MARGIN, CONTENT_W, PAGE_H - MARGIN * 2).stroke().restore();
}

function drawGreyBar(doc: InstanceType<typeof PDFDocument>, y: number, height: number) {
  doc.save().fillColor(GREY).rect(MARGIN, y, CONTENT_W, height).fill().restore();
}

function drawTableGrid(doc: InstanceType<typeof PDFDocument>, y: number, height: number) {
  doc.save().lineWidth(0.5).strokeColor(BORDER);
  doc.rect(MARGIN, y, CONTENT_W, height).stroke();
  const xs = [COL.sac - 4, COL.qty - 4, COL.rate - 4, COL.disc - 4, COL.tax - 4, COL.amount - 4, PAGE_W - MARGIN];
  for (const x of xs) {
    doc.moveTo(x, y).lineTo(x, y + height).stroke();
  }
  doc.restore();
}

function drawTableHeader(doc: InstanceType<typeof PDFDocument>, y: number): number {
  const h = 20;
  drawGreyBar(doc, y, h);
  drawTableGrid(doc, y, h);
  doc.fontSize(7).font("Helvetica-Bold").fillColor("#000");
  doc.text("S.NO.", COL.sno, y + 6, { width: 22 });
  doc.text("SERVICES", COL.service, y + 6, { width: 136 });
  doc.text("HSN/SAC", COL.sac, y + 6, { width: 36 });
  doc.text("QTY.", COL.qty, y + 6, { width: 36, align: "right" });
  doc.text("RATE", COL.rate, y + 6, { width: 42, align: "right" });
  doc.text("DISC.", COL.disc, y + 6, { width: 44, align: "right" });
  doc.text("TAX", COL.tax, y + 6, { width: 44, align: "right" });
  doc.text("AMOUNT", COL.amount, y + 6, { width: CONTENT_W - (COL.amount - MARGIN) - 4, align: "right" });
  return y + h;
}

function computeLineRows(items: InvoiceItem[], invoiceDiscount: number, gstRate = 18) {
  const lineBase = items.map(item => (item.quantity || 0) * (item.unitPrice || 0));
  const baseSum = lineBase.reduce((s, v) => s + v, 0) || 1;
  return items.map(item => {
    const qty = item.quantity || 0;
    const rate = item.unitPrice || 0;
    const gross = qty * rate;
    const lineDisc = item.isComplimentary
      ? gross
      : (item.lineDiscount ?? (invoiceDiscount * (gross / baseSum)));
    const itemRate = item.gstRate ?? gstRate;
    const taxable = item.taxableValue ?? (item.isComplimentary ? 0 : Math.max(0, gross - lineDisc) / (1 + itemRate / 100));
    const tax = item.isComplimentary ? 0 : (item.cgst ?? 0) + (item.sgst ?? 0) + (item.igst ?? 0);
    const amount = item.total ?? 0;
    const discPct = gross > 0 ? Math.round((lineDisc / gross) * 10000) / 100 : 0;
    return {
      item,
      qty,
      rate,
      lineDisc,
      discPct,
      tax,
      amount,
      taxable,
      sac: item.sac ?? item.hsn,
      subtitle: item.subtitle,
      unit: item.unit ?? "UNT",
      isComplimentary: item.isComplimentary,
      gstRate: itemRate,
    };
  });
}

function documentTitle(type: InvoicePdfInput["documentType"]) {
  if (type === "credit_note") return "CREDIT NOTE";
  if (type === "debit_note") return "DEBIT NOTE";
  return "TAX INVOICE";
}

export async function renderInvoicePdf(
  invoice: InvoicePdfInput,
  settings: InvoiceBillingSettings,
  res: NodeJS.WritableStream,
): Promise<void> {
  const doc = new PDFDocument({ size: "A4", margin: 0 });
  doc.pipe(res);
  drawPageBorder(doc);

  const gstRate = 18;
  const taxableAmount = parseFloat(String(invoice.subtotal)) || 0;
  const gstTotal = parseFloat(String(invoice.gstAmount)) || 0;
  const cgst = parseFloat(String(invoice.cgstAmount)) || Math.round((gstTotal / 2) * 100) / 100;
  const sgst = parseFloat(String(invoice.sgstAmount)) || Math.round((gstTotal / 2) * 100) / 100;
  const igst = parseFloat(String(invoice.igstAmount)) || 0;
  const roundOff = parseFloat(String(invoice.roundOff)) || 0;
  const discount = parseFloat(String(invoice.discount)) || 0;
  const totalAmount = parseFloat(String(invoice.totalAmount)) || 0;
  const paidAmount = parseFloat(String(invoice.paidAmount)) || 0;
  const lineRows = computeLineRows(invoice.items, discount, gstRate);
  const totalQty = lineRows.reduce((s, r) => s + r.qty, 0);
  const terms = invoice.terms?.length ? invoice.terms : settings.terms;
  const docTitle = documentTitle(invoice.documentType);

  const headerY = MARGIN + 10;
  const textX = MARGIN + LOGO_SIZE + 8;

  if (settings.pdfLogoUrl) {
    const logoBuf = await fetchImageBuffer(settings.pdfLogoUrl);
    if (logoBuf) {
      doc.image(logoBuf, MARGIN + 6, headerY, { width: LOGO_SIZE, height: LOGO_SIZE });
    }
  }

  doc.fontSize(10.5).font("Helvetica-Bold").fillColor("#000")
    .text(settings.companyName.toUpperCase(), textX, headerY + 2, { width: 250 });

  let leftY = headerY + 16;
  doc.fontSize(7.5).font("Helvetica");
  if (settings.address) {
    doc.text(settings.address, textX, leftY, { width: 270 });
    leftY += doc.heightOfString(settings.address, { width: 270 }) + 3;
  }
  if (settings.gstNumber) { doc.text(`GSTIN: ${settings.gstNumber}`, textX, leftY); leftY += 10; }
  if (settings.phone) { doc.text(`Mobile: ${settings.phone}`, textX, leftY); leftY += 10; }
  if (settings.email) { doc.text(`Email: ${settings.email}`, textX, leftY); leftY += 10; }
  if (settings.panNumber) { doc.text(`PAN Number: ${settings.panNumber}`, textX, leftY); leftY += 10; }
  if (settings.website) { doc.text(`Website: ${settings.website}`, textX, leftY); leftY += 10; }

  doc.fontSize(17).font("Helvetica-Bold").text(docTitle, RIGHT_X, headerY, { width: RIGHT_W, align: "right" });

  const boxW = 128;
  const boxX = PAGE_W - MARGIN - boxW - 4;
  const boxY = headerY + 22;
  doc.save().lineWidth(0.75).strokeColor(BORDER).rect(boxX, boxY, boxW, 16).stroke().restore();
  doc.fontSize(7).font("Helvetica-Bold").text("ORIGINAL FOR RECIPIENT", boxX, boxY + 4, { width: boxW, align: "center" });

  let metaY = boxY + 24;
  const metaRow = (label: string, value: string) => {
    doc.fontSize(8).font("Helvetica-Bold").text(label, RIGHT_X, metaY, { width: 78 });
    doc.font("Helvetica").text(value, RIGHT_X + 80, metaY, { width: RIGHT_W - 80, align: "right" });
    metaY += 13;
  };
  metaRow("Invoice No.:", invoice.invoiceNumber);
  metaRow("Invoice Date:", fmtDate(invoice.issuedAt));
  metaRow("Due Date:", fmtDate(invoice.dueDate));
  if (invoice.documentType !== "tax_invoice" && invoice.referenceInvoiceNumber) {
    metaRow("Against Invoice:", invoice.referenceInvoiceNumber);
    metaRow("Original Date:", fmtDate(invoice.referenceInvoiceDate));
  }

  let y = Math.max(leftY + 6, metaY + 6);

  drawGreyBar(doc, y, 18);
  doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#ffffff").text("BILL TO", MARGIN + 8, y + 5);
  doc.fillColor("#000");
  y += 22;
  doc.fontSize(9.5).font("Helvetica-Bold").text(invoice.customerName, MARGIN + 8, y);
  y += 13;
  doc.fontSize(8).font("Helvetica");
  if (invoice.customerAddress) {
    const addrLine = [invoice.customerAddress, invoice.customerCity].filter(Boolean).join(", ");
    doc.text(addrLine, MARGIN + 8, y, { width: 280 });
    y += doc.heightOfString(addrLine, { width: 280 }) + 2;
  }
  if (invoice.customerPhone) { doc.text(`Mobile: ${invoice.customerPhone}`, MARGIN + 8, y); y += 11; }
  if (invoice.customerEmail) { doc.text(`Email: ${invoice.customerEmail}`, MARGIN + 8, y); y += 11; }
  if (invoice.customerGstin) { doc.text(`GSTIN: ${invoice.customerGstin}`, MARGIN + 8, y); y += 11; }
  doc.text(`Place of Supply: ${invoice.placeOfSupply} (${invoice.supplyStateCode})`, MARGIN + 8, y);
  y += 16;

  y = drawTableHeader(doc, y);
  const bodyStartY = y;
  doc.fontSize(7.5).font("Helvetica");
  let rowIdx = 0;
  for (const row of lineRows) {
    const rowH = row.subtitle ? (row.isComplimentary ? 36 : 30) : (row.isComplimentary ? 26 : 18);
    if (y + rowH > 760) {
      drawTableGrid(doc, bodyStartY, y - bodyStartY);
      doc.addPage();
      drawPageBorder(doc);
      y = MARGIN + 10;
      y = drawTableHeader(doc, y);
    }
    doc.text(String(rowIdx + 1), COL.sno, y + 4, { width: 20 });
    doc.font("Helvetica-Bold").text(row.item.description || "Service", COL.service, y + 4, { width: 132 });
    if (row.subtitle) {
      doc.font("Helvetica").fontSize(6.5).fillColor("#333").text(row.subtitle, COL.service, y + 14, { width: 132 });
      doc.fontSize(7.5).fillColor("#000");
    }
    if (row.isComplimentary) {
      doc.font("Helvetica-Oblique").fontSize(6.5).fillColor("#555")
        .text("Complimentary (No charge)", COL.service, y + (row.subtitle ? 22 : 14), { width: 132 });
      doc.fontSize(7.5).fillColor("#000");
    }
    doc.font("Helvetica").text(row.sac ?? settings.defaultSac, COL.sac, y + 4, { width: 36 });
    doc.text(`${row.qty} ${row.unit}`, COL.qty, y + 4, { width: 36, align: "right" });
    doc.text(fmtInr(row.rate), COL.rate, y + 4, { width: 42, align: "right" });
    doc.text(
      row.isComplimentary ? `${fmtInr(row.rate)} (100%)` : row.lineDisc > 0 ? `${fmtInr(row.lineDisc)}${row.discPct ? ` (${row.discPct}%)` : ""}` : "-",
      COL.disc, y + 4, { width: 44, align: "right",
    });
    doc.text(row.isComplimentary ? "0 (0%)" : `${fmtInr(row.tax)} (${row.gstRate}%)`, COL.tax, y + 4, { width: 44, align: "right" });
    doc.text(row.isComplimentary ? "0" : fmtInr(row.amount), COL.amount, y + 4, { width: CONTENT_W - (COL.amount - MARGIN) - 4, align: "right" });
    y += rowH;
    rowIdx++;
  }

  drawTableGrid(doc, bodyStartY, y - bodyStartY);

  drawGreyBar(doc, y, 18);
  drawTableGrid(doc, y, 18);
  doc.fontSize(7).font("Helvetica-Bold").fillColor("#000");
  doc.text(String(totalQty), COL.qty, y + 5, { width: 36, align: "right" });
  doc.text(discount > 0 ? fmtInr(discount, true) : "-", COL.disc, y + 5, { width: 44, align: "right" });
  doc.text(fmtInr(gstTotal, true), COL.tax, y + 5, { width: 44, align: "right" });
  doc.text(fmtInr(totalAmount, true), COL.amount, y + 5, { width: CONTENT_W - (COL.amount - MARGIN) - 4, align: "right" });
  y += 26;

  if (invoice.hsnSummary.length > 0) {
    doc.fontSize(8).font("Helvetica-Bold").text("HSN/SAC TAX SUMMARY (GST Audit):", MARGIN + 4, y);
    y += 12;
    drawGreyBar(doc, y, 16);
    doc.fontSize(6.5).font("Helvetica-Bold");
    doc.text("HSN/SAC", MARGIN + 4, y + 4, { width: 50 });
    doc.text("Taxable", MARGIN + 58, y + 4, { width: 52, align: "right" });
    doc.text("CGST", MARGIN + 118, y + 4, { width: 44, align: "right" });
    doc.text("SGST", MARGIN + 168, y + 4, { width: 44, align: "right" });
    doc.text("IGST", MARGIN + 218, y + 4, { width: 44, align: "right" });
    doc.text("Total Tax", MARGIN + 268, y + 4, { width: 50, align: "right" });
    y += 18;
    doc.font("Helvetica");
    for (const row of invoice.hsnSummary) {
      doc.text(row.sacOrHsn, MARGIN + 4, y, { width: 50 });
      doc.text(fmtInr(row.taxableValue, true), MARGIN + 58, y, { width: 52, align: "right" });
      doc.text(fmtInr(row.cgstAmount, true), MARGIN + 118, y, { width: 44, align: "right" });
      doc.text(fmtInr(row.sgstAmount, true), MARGIN + 168, y, { width: 44, align: "right" });
      doc.text(fmtInr(row.igstAmount, true), MARGIN + 218, y, { width: 44, align: "right" });
      doc.text(fmtInr(row.totalTax, true), MARGIN + 268, y, { width: 50, align: "right" });
      y += 12;
    }
    y += 8;
  }

  const bottomStartY = y;
  const leftW = 292;

  doc.fontSize(8).font("Helvetica-Bold").text("NOTES:", MARGIN + 4, y);
  y += 11;
  doc.fontSize(7).font("Helvetica").text(invoice.notes?.trim() || "-", MARGIN + 4, y, { width: leftW });
  y += Math.max(12, doc.heightOfString(invoice.notes?.trim() || "-", { width: leftW })) + 6;
  if (invoice.creditReason) {
    doc.fontSize(8).font("Helvetica-Bold").text("REASON FOR CREDIT:", MARGIN + 4, y);
    y += 11;
    doc.fontSize(7).font("Helvetica").text(invoice.creditReason, MARGIN + 4, y, { width: leftW });
    y += doc.heightOfString(invoice.creditReason, { width: leftW }) + 6;
  }

  doc.fontSize(8).font("Helvetica-Bold").text("TERMS AND CONDITIONS:", MARGIN + 4, y);
  y += 11;
  doc.fontSize(6.3).font("Helvetica");
  for (const term of terms) {
    doc.text(`• ${term}`, MARGIN + 4, y, { width: leftW });
    y += doc.heightOfString(`• ${term}`, { width: leftW }) + 1.5;
  }
  y += 6;

  doc.fontSize(8).font("Helvetica-Bold").text("BANK DETAILS:", MARGIN + 4, y);
  y += 11;
  doc.fontSize(7).font("Helvetica");
  doc.text(`Name: ${settings.bankAccountName}`, MARGIN + 4, y, { width: leftW }); y += 9;
  doc.text(`IFSC Code: ${settings.bankIfsc}`, MARGIN + 4, y, { width: leftW }); y += 9;
  doc.text(`Account No: ${settings.bankAccountNumber}`, MARGIN + 4, y, { width: leftW }); y += 9;
  doc.text(`Bank: ${settings.bankName}`, MARGIN + 4, y, { width: leftW }); y += 12;

  doc.fontSize(8).font("Helvetica-Bold").text("PAYMENT QR CODE:", MARGIN + 4, y);
  y += 10;
  const qrBuf = await fetchQrBuffer(settings.upiId, totalAmount);
  if (qrBuf) {
    doc.image(qrBuf, MARGIN + 4, y, { width: 78, height: 78 });
  }
  doc.fontSize(7).font("Helvetica").text(settings.upiId, MARGIN + 4, y + 82, { width: leftW });
  doc.fontSize(6).fillColor("#444").text("PhonePe   GPay   Paytm   BHIM UPI", MARGIN + 4, y + 92, { width: leftW });

  let summaryY = bottomStartY;
  const summaryRow = (label: string, value: string, bold = false) => {
    doc.fontSize(8).font(bold ? "Helvetica-Bold" : "Helvetica").fillColor("#000");
    doc.text(label, RIGHT_X, summaryY, { width: 118 });
    doc.text(value, RIGHT_X + 120, summaryY, { width: RIGHT_W - 120, align: "right" });
    summaryY += 15;
  };
  summaryRow("Taxable Amount:", fmtInr(taxableAmount, true));
  if (invoice.isInterState) {
    summaryRow("IGST @18%:", fmtInr(igst, true));
  } else {
    summaryRow("CGST @9%:", fmtInr(cgst, true));
    summaryRow("SGST @9%:", fmtInr(sgst, true));
  }
  if (roundOff !== 0) summaryRow("Round Off:", fmtInr(roundOff, true));
  doc.save().lineWidth(0.5).strokeColor(BORDER).moveTo(RIGHT_X, summaryY).lineTo(PAGE_W - MARGIN - 4, summaryY).stroke().restore();
  summaryY += 7;
  summaryRow("Total Amount:", fmtInr(totalAmount, true), true);
  summaryRow("Received Amount:", fmtInr(paidAmount, true));

  summaryY += 4;
  doc.fontSize(7.5).font("Helvetica-Bold").text("Total Amount (in words):", RIGHT_X, summaryY, { width: RIGHT_W });
  summaryY += 11;
  doc.fontSize(7).font("Helvetica").text(amountInWords(totalAmount), RIGHT_X, summaryY, { width: RIGHT_W });

  const sigY = Math.max(y + 96, summaryY + 24);
  const sigW = 130;
  const sigX = RIGHT_X + (RIGHT_W - sigW) / 2;
  if (settings.signatureUrl) {
    const sigBuf = await fetchImageBuffer(settings.signatureUrl);
    if (sigBuf) doc.image(sigBuf, sigX, sigY, { width: sigW, height: 42, fit: [sigW, 42] });
  } else {
    drawGreyBar(doc, sigY, 42);
  }
  doc.fontSize(7).font("Helvetica-Bold").fillColor("#000").text(
    `Authorised Signature for ${settings.companyName.toUpperCase()}`,
    RIGHT_X,
    sigY + 46,
    { width: RIGHT_W, align: "center" },
  );

  doc.end();
}
