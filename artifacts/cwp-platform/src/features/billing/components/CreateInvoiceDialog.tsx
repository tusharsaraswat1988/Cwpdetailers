import { useEffect, useMemo, useState } from "react";
import {
  useGetCustomer,
  useListBookings,
  useListSubscriptions,
} from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2 } from "lucide-react";
import { CustomerSearchSelect, type CustomerSearchValue } from "@/features/customers/components/CustomerSearchSelect";
import { useCatalogPackages, useAdminServices, type CatalogPackage } from "@/features/service-catalog/api";
import { useDcmsPlans } from "@/features/daily-cleaning/api";

const DEFAULT_SAC = "998533";

type LineItem = {
  description: string;
  subtitle: string;
  quantity: number;
  unitPrice: number;
  total: number;
  sac: string;
  unit: string;
  isComplimentary: boolean;
  serviceCategory: string;
};

type InvoiceSource = "package" | "solar_amc" | "dcms_plan" | "service" | "booking" | "custom";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCustomerId?: number;
  onCreated?: () => void;
};

function emptyLine(): LineItem {
  return {
    description: "",
    subtitle: "",
    quantity: 1,
    unitPrice: 0,
    total: 0,
    sac: DEFAULT_SAC,
    unit: "UNT",
    isComplimentary: false,
    serviceCategory: "general",
  };
}

function categoryForSource(source: InvoiceSource): string {
  if (source === "dcms_plan") return "dcms";
  if (source === "solar_amc") return "solar";
  if (source === "package") return "package";
  if (source === "service" || source === "booking") return "service";
  return "general";
}

function isSolarAmcPackage(pkg: CatalogPackage) {
  return pkg.slug?.includes("solar-amc") ?? pkg.name.toLowerCase().includes("solar amc");
}

async function fetchGstPreview(items: LineItem[], discount: number) {
  const res = await fetch("/api/invoices/gst-preview", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: items.filter(i => i.description.trim()).map(i => ({
        description: i.description.trim(),
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        total: i.isComplimentary ? 0 : i.total,
        sac: i.sac || DEFAULT_SAC,
        isComplimentary: i.isComplimentary,
        serviceCategory: i.serviceCategory,
      })),
      discount,
      gstInclusive: true,
    }),
  });
  if (!res.ok) throw new Error("GST preview failed");
  const data = await res.json();
  return {
    subtotal: data.subtotal as number,
    gst: data.gstAmount as number,
    total: data.totalAmount as number,
  };
}

async function createInvoiceRequest(body: Record<string, unknown>) {
  const res = await fetch("/api/invoices", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to create invoice");
  }
  return res.json();
}

export function CreateInvoiceDialog({
  open,
  onOpenChange,
  initialCustomerId,
  onCreated,
}: Props) {
  const [customer, setCustomer] = useState<CustomerSearchValue | null>(null);
  const [source, setSource] = useState<InvoiceSource>("package");
  const [productId, setProductId] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [subscriptionId, setSubscriptionId] = useState("");
  const [discount, setDiscount] = useState("0");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [termsText, setTermsText] = useState("");
  const [billing, setBilling] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    gstin: "",
    placeOfSupply: "Uttar Pradesh",
  });
  const [items, setItems] = useState<LineItem[]>([emptyLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gstPreview, setGstPreview] = useState({ subtotal: 0, gst: 0, total: 0 });

  const customerId = customer?.id ?? 0;

  const { data: prefetchedCustomer } = useGetCustomer(customerId || initialCustomerId || 0, {
    query: { enabled: open && (customerId > 0 || !!initialCustomerId) },
  });

  const { data: packages, isLoading: packagesLoading } = useCatalogPackages();
  const { data: dcmsPlans, isLoading: plansLoading } = useDcmsPlans();
  const { data: services, isLoading: servicesLoading } = useAdminServices();
  const { data: bookingsData, isLoading: bookingsLoading } = useListBookings(
    { customerId: String(customerId), limit: "30" } as any,
    { query: { enabled: open && customerId > 0 && source === "booking" } },
  );
  const { data: subscriptions, isLoading: subsLoading } = useListSubscriptions(
    { customerId: String(customerId), limit: "20" } as any,
    { query: { enabled: open && customerId > 0 } },
  );

  const washPackages = useMemo(() => (packages ?? []).filter(p => !isSolarAmcPackage(p)), [packages]);
  const solarPackages = useMemo(() => (packages ?? []).filter(p => isSolarAmcPackage(p)), [packages]);
  const activeServices = useMemo(
    () => (services ?? []).filter(s => s.isActive !== false && s.status !== "archived"),
    [services],
  );
  const billableBookings = useMemo(
    () => (bookingsData?.data ?? []).filter(b => b.status === "completed" && b.amount != null && Number(b.amount) > 0),
    [bookingsData],
  );
  const legacySubscriptions = useMemo(
    () => (subscriptions?.data ?? []).filter(s => s.status === "active" || s.status === "expiring"),
    [subscriptions],
  );

  useEffect(() => {
    if (!open) return;
    if (initialCustomerId && prefetchedCustomer) {
      setCustomer({
        id: prefetchedCustomer.id!,
        name: prefetchedCustomer.name ?? `Customer #${initialCustomerId}`,
        phone: prefetchedCustomer.phone ?? "",
      });
    }
  }, [open, prefetchedCustomer, initialCustomerId]);

  useEffect(() => {
    if (!prefetchedCustomer) return;
    setBilling({
      name: prefetchedCustomer.billingName ?? prefetchedCustomer.name ?? "",
      phone: prefetchedCustomer.phone ?? "",
      email: prefetchedCustomer.email ?? "",
      address: prefetchedCustomer.address ?? "",
      city: prefetchedCustomer.city ?? "",
      gstin: prefetchedCustomer.gstin ?? "",
      placeOfSupply: "Uttar Pradesh",
    });
  }, [prefetchedCustomer]);

  const resetForm = () => {
    if (!initialCustomerId) setCustomer(null);
    setSource("package");
    setProductId("");
    setBookingId("");
    setSubscriptionId("");
    setDiscount("0");
    setDueDate("");
    setNotes("");
    setTermsText("");
    setBilling({ name: "", phone: "", email: "", address: "", city: "", gstin: "", placeOfSupply: "Uttar Pradesh" });
    setItems([emptyLine()]);
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  const applyLineFromProduct = (description: string, subtitle: string, price: number, cat: string) => {
    setItems([{
      ...emptyLine(),
      description,
      subtitle,
      unitPrice: price,
      total: price,
      serviceCategory: cat,
    }]);
  };

  useEffect(() => {
    if (!productId) return;
    const cat = categoryForSource(source);
    if (source === "package") {
      const pkg = washPackages.find(p => String(p.id) === productId);
      if (pkg) applyLineFromProduct(pkg.name, pkg.description ?? "", Number(pkg.price), cat);
    } else if (source === "solar_amc") {
      const pkg = solarPackages.find(p => String(p.id) === productId);
      if (pkg) applyLineFromProduct(pkg.name, pkg.description ?? "", Number(pkg.price), cat);
    } else if (source === "dcms_plan") {
      const plan = (dcmsPlans ?? []).find(p => String(p.id) === productId);
      if (plan) applyLineFromProduct(plan.name, plan.description ?? "", Number(plan.price), cat);
    } else if (source === "service") {
      const svc = activeServices.find(s => String(s.id) === productId);
      if (svc) applyLineFromProduct(svc.name, svc.description ?? "", Number(svc.basePrice), cat);
    }
  }, [source, productId, washPackages, solarPackages, dcmsPlans, activeServices]);

  useEffect(() => {
    if (!bookingId || source !== "booking") return;
    const booking = billableBookings.find(b => String(b.id) === bookingId);
    if (!booking) return;
    const amount = Number(booking.amount);
    const label = booking.serviceName ?? booking.serviceType?.replace(/_/g, " ") ?? "Service";
    applyLineFromProduct(label, `Booking #${booking.id}`, amount, "service");
  }, [bookingId, source, billableBookings]);

  const updateItem = (idx: number, patch: Partial<LineItem>) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const next = { ...it, ...patch };
      if (next.isComplimentary) {
        next.total = 0;
      } else {
        next.total = Math.round(next.quantity * next.unitPrice * 100) / 100;
      }
      return next;
    }));
  };

  const disc = parseFloat(discount || "0");
  const hasValidLines = items.some(i => i.description.trim() && (i.isComplimentary || i.total > 0));

  useEffect(() => {
    if (!open || !hasValidLines) {
      setGstPreview({ subtotal: 0, gst: 0, total: 0 });
      return;
    }
    let cancelled = false;
    fetchGstPreview(items, disc)
      .then(p => { if (!cancelled) setGstPreview(p); })
      .catch(() => { if (!cancelled) setGstPreview({ subtotal: 0, gst: 0, total: 0 }); });
    return () => { cancelled = true; };
  }, [open, items, disc, hasValidLines]);

  const { subtotal, gst, total } = gstPreview;

  const handleSubmit = async () => {
    if (!customer) {
      setError("Select a customer");
      return;
    }
    if (!hasValidLines) {
      setError("Add at least one line item with description (paid or complimentary)");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const terms = termsText.trim()
        ? termsText.split("\n").map(t => t.trim()).filter(Boolean)
        : undefined;

      await createInvoiceRequest({
        customerId: customer.id,
        documentType: "tax_invoice",
        subscriptionId: subscriptionId ? parseInt(subscriptionId, 10) : undefined,
        bookingId: bookingId ? parseInt(bookingId, 10) : undefined,
        discount: disc,
        dueDate: dueDate || undefined,
        gstInclusive: true,
        notes: notes.trim() || undefined,
        terms,
        placeOfSupply: billing.placeOfSupply,
        customerSnapshot: {
          name: billing.name || customer.name,
          phone: billing.phone || customer.phone,
          email: billing.email || null,
          address: billing.address || null,
          city: billing.city || null,
          gstin: billing.gstin || null,
          placeOfSupply: billing.placeOfSupply,
        },
        items: items.filter(i => i.description.trim()).map(i => ({
          description: i.description.trim(),
          subtitle: i.subtitle.trim() || undefined,
          quantity: i.quantity,
          unit: i.unit,
          unitPrice: i.unitPrice,
          total: i.isComplimentary ? 0 : i.total,
          sac: i.sac || DEFAULT_SAC,
          isComplimentary: i.isComplimentary,
          serviceCategory: i.serviceCategory,
        })),
      });
      onCreated?.();
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invoice");
    } finally {
      setSubmitting(false);
    }
  };

  const sourceLoading =
    (source === "package" || source === "solar_amc") && packagesLoading
    || source === "dcms_plan" && plansLoading
    || source === "service" && servicesLoading
    || source === "booking" && bookingsLoading;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Tax Invoice</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label>Customer</Label>
            <CustomerSearchSelect
              value={customer}
              onChange={c => {
                setCustomer(c);
                setBookingId("");
                setSubscriptionId("");
                setProductId("");
              }}
              testId="invoice-create-customer"
            />
          </div>

          {customer && (
            <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/20">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Bill To (GST snapshot)</p>
              <div className="grid sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Billing name</Label>
                  <Input value={billing.name} onChange={e => setBilling(b => ({ ...b, name: e.target.value }))} className="mt-1 h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Mobile</Label>
                  <Input value={billing.phone} onChange={e => setBilling(b => ({ ...b, phone: e.target.value }))} className="mt-1 h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Email</Label>
                  <Input value={billing.email} onChange={e => setBilling(b => ({ ...b, email: e.target.value }))} className="mt-1 h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Customer GSTIN</Label>
                  <Input value={billing.gstin} onChange={e => setBilling(b => ({ ...b, gstin: e.target.value.toUpperCase() }))} placeholder="Optional for B2C" className="mt-1 h-8 text-sm" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Address</Label>
                  <Input value={billing.address} onChange={e => setBilling(b => ({ ...b, address: e.target.value }))} className="mt-1 h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">City</Label>
                  <Input value={billing.city} onChange={e => setBilling(b => ({ ...b, city: e.target.value }))} className="mt-1 h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Place of supply</Label>
                  <Input value={billing.placeOfSupply} onChange={e => setBilling(b => ({ ...b, placeOfSupply: e.target.value }))} className="mt-1 h-8 text-sm" />
                </div>
              </div>
            </div>
          )}

          {(
            <div>
              <Label>Bill for</Label>
              <Select value={source} onValueChange={v => { setSource(v as InvoiceSource); setProductId(""); setBookingId(""); setItems([emptyLine()]); }}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="package">Wash package</SelectItem>
                  <SelectItem value="solar_amc">Solar AMC</SelectItem>
                  <SelectItem value="dcms_plan">Daily cleaning plan</SelectItem>
                  <SelectItem value="service">One-time service</SelectItem>
                  <SelectItem value="booking">Completed booking</SelectItem>
                  <SelectItem value="custom">Custom line items</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {source === "package" && (
            <div>
              <Label>Package</Label>
              {packagesLoading ? <Skeleton className="h-10 mt-1" /> : (
                <Select value={productId || "none"} onValueChange={v => setProductId(v === "none" ? "" : v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select package" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled>Select package</SelectItem>
                    {washPackages.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name} · ₹{Number(p.price).toLocaleString("en-IN")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {source === "solar_amc" && (
            <div>
              <Label>Solar AMC</Label>
              {packagesLoading ? <Skeleton className="h-10 mt-1" /> : (
                <Select value={productId || "none"} onValueChange={v => setProductId(v === "none" ? "" : v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled>Select package</SelectItem>
                    {solarPackages.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name} · ₹{Number(p.price).toLocaleString("en-IN")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {source === "dcms_plan" && (
            <div>
              <Label>Daily cleaning plan</Label>
              {plansLoading ? <Skeleton className="h-10 mt-1" /> : (
                <Select value={productId || "none"} onValueChange={v => setProductId(v === "none" ? "" : v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled>Select plan</SelectItem>
                    {(dcmsPlans ?? []).filter(p => p.isActive).map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name} · ₹{Number(p.price).toLocaleString("en-IN")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {source === "service" && (
            <div>
              <Label>Service</Label>
              {servicesLoading ? <Skeleton className="h-10 mt-1" /> : (
                <Select value={productId || "none"} onValueChange={v => setProductId(v === "none" ? "" : v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled>Select service</SelectItem>
                    {activeServices.map(s => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name} · ₹{Number(s.basePrice).toLocaleString("en-IN")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {source === "booking" && customer && (
            <div>
              <Label>Completed booking</Label>
              {bookingsLoading ? <Skeleton className="h-10 mt-1" /> : billableBookings.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-1">No billable bookings</p>
              ) : (
                <Select value={bookingId || "none"} onValueChange={v => setBookingId(v === "none" ? "" : v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled>Select booking</SelectItem>
                    {billableBookings.map(b => (
                      <SelectItem key={b.id} value={String(b.id)}>
                        #{b.id} · ₹{Number(b.amount).toLocaleString("en-IN")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {sourceLoading && source !== "custom" && source !== "booking" && (
            <Skeleton className="h-16" />
          )}

          <div className="space-y-2">
            <Label>Line items (HSN/SAC {DEFAULT_SAC} for car wash services)</Label>
            {items.map((item, idx) => (
              <div key={idx} className="border border-border rounded-lg p-3 space-y-2">
                <div className="grid sm:grid-cols-2 gap-2">
                  <Input
                    value={item.description}
                    onChange={e => updateItem(idx, { description: e.target.value })}
                    placeholder="Service name *"
                    disabled={source !== "custom" && !!productId}
                  />
                  <Input
                    value={item.subtitle}
                    onChange={e => updateItem(idx, { subtitle: e.target.value })}
                    placeholder="Description / inclusions"
                  />
                </div>
                <div className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-3">
                    <Label className="text-xs">SAC</Label>
                    <Input value={item.sac} onChange={e => updateItem(idx, { sac: e.target.value })} className="h-8 text-sm" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Qty</Label>
                    <Input type="number" min={1} value={item.quantity} onChange={e => updateItem(idx, { quantity: parseFloat(e.target.value || "1") })} className="h-8 text-sm" disabled={source !== "custom" && !!productId} />
                  </div>
                  <div className="col-span-3">
                    <Label className="text-xs">Rate (₹)</Label>
                    <Input type="number" min={0} value={item.unitPrice} onChange={e => updateItem(idx, { unitPrice: parseFloat(e.target.value || "0") })} className="h-8 text-sm" disabled={source !== "custom" && !!productId && !item.isComplimentary} />
                  </div>
                  <div className="col-span-2 text-sm font-medium pb-1">
                    {item.isComplimentary ? "Free" : `₹${item.total.toLocaleString("en-IN")}`}
                  </div>
                  <div className="col-span-2 flex items-center gap-1 pb-1">
                    <Checkbox
                      checked={item.isComplimentary}
                      onCheckedChange={v => updateItem(idx, { isComplimentary: !!v })}
                      id={`compl-${idx}`}
                    />
                    <Label htmlFor={`compl-${idx}`} className="text-xs cursor-pointer">Free</Label>
                  </div>
                </div>
                {source === "custom" && items.length > 1 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}>
                    <Trash2 size={14} className="mr-1" /> Remove
                  </Button>
                )}
              </div>
            ))}
            {source === "custom" && (
              <Button type="button" variant="outline" size="sm" onClick={() => setItems(prev => [...prev, emptyLine()])}>
                <Plus size={14} className="mr-1" /> Add line
              </Button>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Invoice discount (₹)</Label>
              <Input type="number" min={0} value={discount} onChange={e => setDiscount(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Due date</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="mt-1" />
            </div>
          </div>

          <div>
            <Label>Additional notes (printed on invoice)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. For May and June 2026" className="mt-1 min-h-[60px]" />
          </div>

          <div>
            <Label>Terms & conditions (optional override, one per line)</Label>
            <Textarea value={termsText} onChange={e => setTermsText(e.target.value)} placeholder="Leave blank to use default + service-specific terms" className="mt-1 min-h-[80px]" />
          </div>

          {customer && legacySubscriptions.length > 0 && (
            <div>
              <Label>Link legacy subscription (optional)</Label>
              {subsLoading ? <Skeleton className="h-10 mt-1" /> : (
                <Select value={subscriptionId || "none"} onValueChange={v => setSubscriptionId(v === "none" ? "" : v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {legacySubscriptions.map(s => (
                      <SelectItem key={s.id} value={String(s.id)}>#{s.id} · {s.type?.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="rounded-lg bg-muted/40 border border-border p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Taxable value</span><span>₹{subtotal.toLocaleString("en-IN")}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">GST (catalog rate)</span><span>₹{gst.toLocaleString("en-IN")}</span></div>
            <div className="flex justify-between font-semibold border-t border-border pt-2 mt-2">
              <span>Total</span><span>₹{total.toLocaleString("en-IN")}</span>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button onClick={handleSubmit} disabled={submitting || !customer || !hasValidLines} className="w-full">
            {submitting ? "Creating..." : "Create tax invoice"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
