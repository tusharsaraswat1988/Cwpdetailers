import { useRef, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRequestUploadUrl } from "@workspace/api-client-react";
import { Link } from "wouter";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { uploadFileToCloudinary } from "@/lib/media-url";
import {
  fetchInvoiceBillingSettings,
  saveInvoiceBillingSettings,
  INVOICE_BILLING_QUERY_KEY,
} from "@/features/billing/api";
import { Loader2, Save, Upload, FileText, Building2, Landmark, QrCode, PenLine, ArrowLeft } from "lucide-react";

function SignatureUploader({
  currentUrl,
  onUploaded,
}: {
  currentUrl?: string | null;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const requestUpload = useRequestUploadUrl();

  const handleFile = async (file: File) => {
    const allowed = ["image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast({ title: "Invalid file", description: "Use PNG, JPEG, or WebP for signature.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const presign = await requestUpload.mutateAsync({
        data: { name: file.name, size: file.size, contentType: file.type },
      });
      const url = await uploadFileToCloudinary(file, presign as Parameters<typeof uploadFileToCloudinary>[1]);
      onUploaded(url);
      toast({ title: "Signature uploaded" });
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Could not upload",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      {currentUrl ? (
        <div className="border rounded-lg p-3 bg-white inline-block">
          <img src={currentUrl} alt="Authorised signature" className="max-h-16 max-w-[200px] object-contain" />
        </div>
      ) : (
        <div className="border border-dashed rounded-lg h-16 w-48 bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">
          No signature
        </div>
      )}
      <div>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />
        <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 size={14} className="animate-spin mr-1" /> : <Upload size={14} className="mr-1" />}
          Upload signature
        </Button>
      </div>
    </div>
  );
}

export default function InvoiceBillingSettingsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({
    queryKey: INVOICE_BILLING_QUERY_KEY,
    queryFn: fetchInvoiceBillingSettings,
  });

  const [form, setForm] = useState({
    companyName: "",
    address: "",
    gstNumber: "",
    panNumber: "",
    phone: "",
    email: "",
    website: "",
    defaultSac: "998533",
    bankAccountName: "",
    bankName: "",
    bankAccountNumber: "",
    bankIfsc: "",
    upiId: "",
    placeOfSupply: "",
    signatureUrl: null as string | null,
    termsText: "",
  });

  useEffect(() => {
    if (!data?.settings) return;
    const s = data.settings;
    setForm({
      companyName: s.companyName ?? "",
      address: s.address ?? "",
      gstNumber: s.gstNumber ?? "",
      panNumber: s.panNumber ?? "",
      phone: s.phone ?? "",
      email: s.email ?? "",
      website: s.website ?? "",
      defaultSac: s.defaultSac ?? "998533",
      bankAccountName: s.bankAccountName ?? "",
      bankName: s.bankName ?? "",
      bankAccountNumber: s.bankAccountNumber ?? "",
      bankIfsc: s.bankIfsc ?? "",
      upiId: s.upiId ?? "",
      placeOfSupply: s.placeOfSupply ?? "",
      signatureUrl: s.signatureUrl ?? null,
      termsText: (s.terms ?? []).join("\n"),
    });
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => saveInvoiceBillingSettings({
      ...form,
      gstNumber: form.gstNumber || null,
      panNumber: form.panNumber || null,
      signatureUrl: form.signatureUrl,
      terms: form.termsText.split("\n").map(t => t.trim()).filter(Boolean),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INVOICE_BILLING_QUERY_KEY });
      toast({ title: "Invoice settings saved", description: "PDF invoices will use these details." });
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="max-w-3xl mx-auto space-y-4 p-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-6 pb-12">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href="/admin/billing" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1 mb-2">
              <ArrowLeft size={12} /> Back to Billing & Finance
            </Link>
            <h1 className="font-display font-bold text-2xl flex items-center gap-2">
              <FileText size={22} className="text-primary" />
              Invoice & GST Settings
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Tax invoice PDF layout, bank/UPI, signature, SAC code, and terms for GST/CA audit compliance.
            </p>
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />}
            Save settings
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Building2 size={16} /> Company on invoice</CardTitle>
            <CardDescription>Overrides Business Info / Brand for PDF header only.</CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label>Company name</Label>
              <Input value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} className="mt-1" />
            </div>
            <div className="sm:col-span-2">
              <Label>Address</Label>
              <Textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="mt-1 min-h-[60px]" />
            </div>
            <div>
              <Label>GSTIN</Label>
              <Input value={form.gstNumber} onChange={e => setForm(f => ({ ...f, gstNumber: e.target.value.toUpperCase() }))} className="mt-1" />
            </div>
            <div>
              <Label>PAN</Label>
              <Input value={form.panNumber} onChange={e => setForm(f => ({ ...f, panNumber: e.target.value.toUpperCase() }))} className="mt-1" />
            </div>
            <div>
              <Label>Mobile</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Website</Label>
              <Input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Default place of supply</Label>
              <Input value={form.placeOfSupply} onChange={e => setForm(f => ({ ...f, placeOfSupply: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Default SAC (services)</Label>
              <Input value={form.defaultSac} onChange={e => setForm(f => ({ ...f, defaultSac: e.target.value }))} placeholder="998533" className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">998533 = car wash / maintenance services</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Landmark size={16} /> Bank details</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label>Account name</Label>
              <Input value={form.bankAccountName} onChange={e => setForm(f => ({ ...f, bankAccountName: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Bank & branch</Label>
              <Input value={form.bankName} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Account number</Label>
              <Input value={form.bankAccountNumber} onChange={e => setForm(f => ({ ...f, bankAccountNumber: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>IFSC</Label>
              <Input value={form.bankIfsc} onChange={e => setForm(f => ({ ...f, bankIfsc: e.target.value.toUpperCase() }))} className="mt-1" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><QrCode size={16} /> UPI payment</CardTitle>
            <CardDescription>Used for QR code on invoice PDF.</CardDescription>
          </CardHeader>
          <CardContent>
            <Label>UPI ID</Label>
            <Input value={form.upiId} onChange={e => setForm(f => ({ ...f, upiId: e.target.value }))} placeholder="merchant@upi" className="mt-1 max-w-md" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><PenLine size={16} /> Authorised signature</CardTitle>
            <CardDescription>Appears on bottom-right of tax invoice PDF.</CardDescription>
          </CardHeader>
          <CardContent>
            <SignatureUploader
              currentUrl={form.signatureUrl}
              onUploaded={url => setForm(f => ({ ...f, signatureUrl: url }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Terms & conditions</CardTitle>
            <CardDescription>One term per line. Service-specific terms (daily cleaning, package, solar) are added automatically on invoices.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={form.termsText}
              onChange={e => setForm(f => ({ ...f, termsText: e.target.value }))}
              className="min-h-[160px] font-mono text-xs"
            />
            {data?.serviceCategoryTerms && (
              <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-2">
                <p className="font-semibold">Auto-added by service type:</p>
                {Object.entries(data.serviceCategoryTerms).filter(([, v]) => v.length).map(([cat, terms]) => (
                  <div key={cat}>
                    <span className="font-medium capitalize">{cat}:</span>{" "}
                    <span className="text-muted-foreground">{terms[0]}{terms.length > 1 ? ` (+${terms.length - 1} more)` : ""}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} size="lg">
            {saveMutation.isPending ? "Saving…" : "Save all settings"}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
