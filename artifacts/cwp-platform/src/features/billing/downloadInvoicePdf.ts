export async function downloadInvoicePdf(invoiceId: number, invoiceNumber?: string | null): Promise<void> {
  const res = await fetch(`/api/invoices/${invoiceId}/pdf`);
  if (!res.ok) {
    let message = "Failed to download PDF";
    try {
      const body = await res.json();
      message = body.error ?? message;
    } catch {
      /* response was not JSON */
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  if (!blob.type.includes("pdf")) {
    throw new Error("Invalid PDF response from server");
  }

  const filename = `${(invoiceNumber ?? `invoice-${invoiceId}`).replace(/\//g, "-")}.pdf`;
  const url = URL.createObjectURL(blob);
  const tab = window.open(url, "_blank");
  if (!tab) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
