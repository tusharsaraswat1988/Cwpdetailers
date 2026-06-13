import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRequestUploadUrl } from "@workspace/api-client-react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { uploadFileToCloudinary } from "@/lib/media-url";
import {
  fetchAdminBranding,
  processBrandingAssets,
  updateBranding,
  uploadBrandingAsset,
} from "@/lib/branding/api";
import { BRANDING_ADMIN_QUERY_KEY, BRANDING_QUERY_KEY, type BrandAssetSlot } from "@/lib/branding/types";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { Loader2, RefreshCw, Upload } from "lucide-react";

type AssetField = {
  slot: BrandAssetSlot;
  label: string;
  field: string;
  hint?: string;
  autoGenerate?: boolean;
};

const LOGO_FIELDS: AssetField[] = [
  { slot: "full_logo", label: "Full Logo (Horizontal)", field: "fullLogoUrl", hint: "SVG or PNG recommended. Auto-generates favicons & PWA icons.", autoGenerate: true },
  { slot: "navbar_logo", label: "Navbar Logo", field: "navbarLogoUrl" },
  { slot: "mobile_logo", label: "Mobile Logo", field: "mobileLogoUrl" },
  { slot: "login_logo", label: "Login Screen Logo", field: "loginLogoUrl" },
  { slot: "light_logo", label: "Light Mode Logo", field: "lightLogoUrl" },
  { slot: "dark_logo", label: "Dark Mode Logo", field: "darkLogoUrl" },
  { slot: "favicon", label: "Favicon", field: "faviconUrl" },
  { slot: "pwa_icon", label: "PWA App Icon", field: "pwaIconUrl", autoGenerate: true },
  { slot: "apple_touch_icon", label: "Apple Touch Icon", field: "appleTouchIconUrl" },
  { slot: "email_logo", label: "Email Header Logo", field: "emailLogoUrl" },
  { slot: "invoice_logo", label: "Invoice Logo", field: "invoiceLogoUrl" },
  { slot: "pdf_logo", label: "PDF Report Logo", field: "pdfLogoUrl" },
  { slot: "og_image", label: "Open Graph Image", field: "ogImageUrl" },
];

function AssetUploader({
  slot,
  label,
  hint,
  currentUrl,
  autoGenerate,
  onUploaded,
}: AssetField & { currentUrl?: string | null; onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const requestUpload = useRequestUploadUrl();

  const handleFile = async (file: File) => {
    const allowed = ["image/png", "image/webp", "image/svg+xml"];
    if (!allowed.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Only SVG, PNG, and WebP are allowed.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum upload size is 10 MB.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      let svgContent: string | undefined;
      if (file.type === "image/svg+xml") {
        svgContent = await file.text();
      }

      const presign = await requestUpload.mutateAsync({
        data: { name: file.name, size: file.size, contentType: file.type },
      });

      const url = await uploadFileToCloudinary(file, presign as Parameters<typeof uploadFileToCloudinary>[1]);

      await uploadBrandingAsset({
        url,
        slot,
        contentType: file.type,
        size: file.size,
        svgContent,
        regenerateDerivatives: autoGenerate,
      });

      toast({ title: "Uploaded", description: `${label} updated across the platform.` });
      onUploaded();
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Could not upload asset",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-sm">{label}</p>
          {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          <span className="ml-1.5">Upload</span>
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/webp,image/svg+xml"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
      </div>
      {currentUrl && (
        <div className="h-14 flex items-center bg-muted/40 rounded-md px-3">
          <img src={currentUrl} alt={label} className="max-h-10 max-w-[200px] object-contain" loading="lazy" />
        </div>
      )}
    </div>
  );
}

export default function BrandIdentity() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: row, isLoading } = useQuery({
    queryKey: BRANDING_ADMIN_QUERY_KEY,
    queryFn: fetchAdminBranding,
  });

  const [form, setForm] = useState<Record<string, string>>({});

  const merged = { ...(row ?? {}), ...form } as Record<string, string | null>;

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: BRANDING_ADMIN_QUERY_KEY });
    void qc.invalidateQueries({ queryKey: BRANDING_QUERY_KEY });
  };

  const saveMutation = useMutation({
    mutationFn: () => updateBranding(form),
    onSuccess: () => {
      toast({ title: "Saved", description: "Brand identity updated platform-wide." });
      setForm({});
      invalidate();
    },
    onError: (err: Error) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
  });

  const processMutation = useMutation({
    mutationFn: processBrandingAssets,
    onSuccess: () => {
      toast({ title: "Assets regenerated", description: "Favicons, PWA icons, and OG images updated." });
      invalidate();
    },
    onError: (err: Error) => toast({ title: "Processing failed", description: err.message, variant: "destructive" }),
  });

  const set = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-5xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold">Brand Identity</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage logos, colors, and company info — changes propagate across all portals instantly.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              disabled={processMutation.isPending}
              onClick={() => processMutation.mutate()}
            >
              {processMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              <span className="ml-1.5">Regenerate Icons</span>
            </Button>
            <Button size="sm" disabled={saveMutation.isPending || Object.keys(form).length === 0} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Live Preview</CardTitle>
            <CardDescription>How branding appears in the admin sidebar</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3 bg-secondary rounded-lg p-4 w-fit">
            <BrandLogo variant="navbar" imgClassName="h-8" fallbackClassName="w-8 h-8" lazy={false} />
            <div>
              <p className="text-white font-display font-bold text-sm">{merged.brandName ?? "Brand"}</p>
              <p className="text-white/40 text-xs">{merged.tagline ?? "Tagline"}</p>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="company">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="company">Company</TabsTrigger>
            <TabsTrigger value="assets">Logos & Assets</TabsTrigger>
            <TabsTrigger value="colors">Colors</TabsTrigger>
            <TabsTrigger value="seo">SEO & Social</TabsTrigger>
          </TabsList>

          <TabsContent value="company" className="space-y-4 mt-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Company Name</Label>
                <Input className="mt-1.5" defaultValue={merged.companyName ?? ""} onChange={e => set("companyName", e.target.value)} />
              </div>
              <div>
                <Label>Brand Name</Label>
                <Input className="mt-1.5" defaultValue={merged.brandName ?? ""} onChange={e => set("brandName", e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label>Tagline</Label>
                <Input className="mt-1.5" defaultValue={merged.tagline ?? ""} onChange={e => set("tagline", e.target.value)} />
              </div>
              <div>
                <Label>Website</Label>
                <Input className="mt-1.5" type="url" defaultValue={merged.website ?? ""} onChange={e => set("website", e.target.value)} />
              </div>
              <div>
                <Label>Support Email</Label>
                <Input className="mt-1.5" type="email" defaultValue={merged.supportEmail ?? ""} onChange={e => set("supportEmail", e.target.value)} />
              </div>
              <div>
                <Label>Support Phone</Label>
                <Input className="mt-1.5" defaultValue={merged.supportPhone ?? ""} onChange={e => set("supportPhone", e.target.value)} />
              </div>
              <div>
                <Label>GST Number</Label>
                <Input className="mt-1.5" defaultValue={merged.gstNumber ?? ""} onChange={e => set("gstNumber", e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label>Business Address</Label>
                <Textarea className="mt-1.5" rows={2} defaultValue={merged.address ?? ""} onChange={e => set("address", e.target.value)} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="assets" className="space-y-3 mt-4">
            <p className="text-sm text-muted-foreground">
              Upload a high-quality horizontal logo first — favicons, PWA icons, and OG images are generated automatically.
            </p>
            <div className="grid md:grid-cols-2 gap-3">
              {LOGO_FIELDS.map(field => (
                <AssetUploader
                  key={field.slot}
                  {...field}
                  currentUrl={(row as Record<string, string | null>)?.[field.field]}
                  onUploaded={invalidate}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="colors" className="space-y-4 mt-4">
            <div className="grid sm:grid-cols-2 gap-4">
              {([
                ["primaryColor", "Primary Color", "--brand-primary"],
                ["secondaryColor", "Secondary Color", "--brand-secondary"],
                ["accentColor", "Accent Color", "--brand-accent"],
                ["backgroundColor", "Background Color", "--brand-background"],
              ] as const).map(([key, label, cssVar]) => (
                <div key={key}>
                  <Label>{label}</Label>
                  <div className="flex gap-2 mt-1.5">
                    <Input type="color" className="w-14 h-10 p-1" defaultValue={merged[key] ?? "#00cccc"} onChange={e => set(key, e.target.value)} />
                    <Input defaultValue={merged[key] ?? ""} onChange={e => set(key, e.target.value)} placeholder={cssVar} />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Colors map to CSS variables (<code>--brand-primary</code>, etc.) and update the entire platform theme.
            </p>
          </TabsContent>

          <TabsContent value="seo" className="space-y-4 mt-4">
            <div className="grid gap-4">
              <div>
                <Label>Meta Title Template</Label>
                <Input className="mt-1.5" placeholder="{brand} | {tagline}" defaultValue={merged.metaTitleTemplate ?? ""} onChange={e => set("metaTitleTemplate", e.target.value)} />
              </div>
              <div>
                <Label>Meta Description Template</Label>
                <Textarea className="mt-1.5" rows={2} defaultValue={merged.metaDescriptionTemplate ?? ""} onChange={e => set("metaDescriptionTemplate", e.target.value)} />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>OpenGraph Title</Label>
                  <Input className="mt-1.5" defaultValue={merged.ogTitle ?? ""} onChange={e => set("ogTitle", e.target.value)} />
                </div>
                <div>
                  <Label>Twitter Card Type</Label>
                  <Input className="mt-1.5" defaultValue={merged.twitterCardType ?? "summary_large_image"} onChange={e => set("twitterCardType", e.target.value)} />
                </div>
              </div>
              <div>
                <Label>OpenGraph Description</Label>
                <Textarea className="mt-1.5" rows={2} defaultValue={merged.ogDescription ?? ""} onChange={e => set("ogDescription", e.target.value)} />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
