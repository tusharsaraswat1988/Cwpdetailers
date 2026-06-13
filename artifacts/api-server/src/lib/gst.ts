export function computeGst(baseAmount: number, rate = 18) {
  const gst = Math.round(baseAmount * (rate / 100) * 100) / 100;
  const total = Math.round((baseAmount + gst) * 100) / 100;
  return {
    subtotal: baseAmount,
    gst,
    total,
  };
}

/** Split a GST-inclusive total into base + GST (display prices are inclusive). */
export function splitGstInclusive(inclusiveTotal: number, rate = 18) {
  const subtotal = Math.round((inclusiveTotal / (1 + rate / 100)) * 100) / 100;
  const gst = Math.round((inclusiveTotal - subtotal) * 100) / 100;
  return { subtotal, gst, total: inclusiveTotal };
}

export function formatCurrency(amount: number, currency = "INR") {
  if (currency === "INR") {
    return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${amount.toFixed(2)} ${currency}`;
}
