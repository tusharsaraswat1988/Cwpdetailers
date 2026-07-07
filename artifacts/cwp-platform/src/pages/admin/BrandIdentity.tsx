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
  { slot: "light_logo", label: "Light Logo", field: "lightLogoUrl" },
  { slot: "dark_logo", label: "Dark Logo", field: "darkLogoUrl" },
  { slot: "white_logo", label: "White Logo", field: "logoWhiteUrl" },
  { slot: "transparent_logo", label: "Transparent Logo", field: "logoTransparentUrl" },
  { slot: "square_logo", label: "Square Logo", field: "logoSquareUrl" },
  { slot: "logo_icon", label: "Logo Icon", field: "logoIconUrl" },
  { slot: "full_logo", label: "Full Logo (Horizontal)", field: "fullLogoUrl", hint: "Primary logo — auto-generates favicons & PWA icons.", autoGenerate: true },
  { slot: "navbar_logo", label: "Navbar Logo", field: "navbarLogoUrl" },
  { slot: "splash_logo", label: "Splash Logo", field: "splashLogoUrl" },
  { slot: "email_logo", label: "Email Logo", field: "emailLogoUrl" },
  { slot: "invoice_logo", label: "Invoice Logo", field: "invoiceLogoUrl" },
  { slot: "pdf_logo", label: "PDF Report Logo", field: "pdfLogoUrl" },
  { slot: "login_logo", label: "Login Screen Logo", field: "loginLogoUrl" },
];

const FAVICON_FIELDS: AssetField[] = [
  { slot: "favicon_ico", label: "favicon.ico", field: "faviconIcoUrl" },
  { slot: "favicon", label: "Favicon (32×32)", field: "faviconUrl" },
  { slot: "apple_touch_icon", label: "Apple Touch Icon", field: "appleTouchIconUrl" },
  { slot: "pwa_icon", label: "Android 192 / PWA Icon", field: "pwaIconUrl", autoGenerate: true },
];

const SEO_FIELDS: AssetField[] = [
  { slot: "og_image", label: "Default Open Graph Image", field: "ogImageUrl" },
  { slot: "twitter_image", label: "Default Twitter Image", field: "twitterImageUrl" },
];

const LOADER_FIELDS: AssetField[] = [
  { slot: "loader_animation", label: "Loader Animation", field: "loaderAnimationUrl", hint: "GIF, SVG, or PNG animation shown during loading states." },
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
    const allowed = ["image/png", "image/webp", "image/svg+xml", "image/gif", "image/x-icon", "image/vnd.microsoft.icon"];
    if (!allowed.includes(file.type) && !file.name.endsWith(".ico")) {
      toast({ title: "Invalid file type", description: "Only SVG, PNG, WebP, GIF, and ICO are allowed.", variant: "destructive" });
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
        data: { name: file.name, size: file.size, contentType: file.type || "image/png" },
      });

      const url = await uploadFileToCloudinary(file, presign as Parameters<typeof uploadFileToCloudinary>[1]);

      await uploadBrandingAsset({
        url,
        slot,
        contentType: file.type || "image/png",
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
          accept="image/png,image/webp,image/svg+xml,image/gif,.ico"
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
      toast({ title: "Saved", description: "Branding settings updated platform-wide." });
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

  const rowData = row as Record<string, string | null>;

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-5xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold">Branding</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Single source of truth for logos, colors, SEO, and loaders — changes propagate across all portals instantly.
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
            <CardDescription>Theme colors and logo as they appear across the platform</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div
              className="flex items-center gap-3 rounded-lg p-4 w-fit"
              style={{ backgroundColor: merged.secondaryColor ?? "#212529" }}
            >
              <BrandLogo variant="navbar" lazy={false} />
              <div>
                <p className="text-white font-display font-bold text-sm">{merged.brandName ?? "Brand"}</p>
                <p className="text-white/40 text-xs">{merged.tagline ?? "Tagline"}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {(["primaryColor", "secondaryColor", "accentColor", "backgroundColor"] as const).map(key => (
                <div key={key} className="text-center">
                  <div
                    className="w-10 h-10 rounded-md border"
                    style={{ backgroundColor: merged[key] ?? "#ccc" }}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">{key.replace("Color", "")}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="identity">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="identity">Identity</TabsTrigger>
            <TabsTrigger value="logos">Logos</TabsTrigger>
            <TabsTrigger value="favicons">Favicons</TabsTrigger>
            <TabsTrigger value="seo">SEO</TabsTrigger>
            <TabsTrigger value="theme">Theme</TabsTrigger>
            <TabsTrigger value="loader">Loader</TabsTrigger>
          </TabsList>

          <TabsContent value="identity" className="space-y-4 mt-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Brand Name</Label>
                <Input className="mt-1.5" defaultValue={merged.brandName ?? ""} onChange={e => set("brandName", e.target.value)} />
              </div>
              <div>
                <Label>Company Name</Label>
                <Input className="mt-1.5" defaultValue={merged.companyName ?? ""} onChange={e => set("companyName", e.target.value)} />
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
              <div className="sm:col-span-2">
                <Label>Short Description</Label>
                <Textarea className="mt-1.5" rows={2} defaultValue={merged.shortDescription ?? ""} onChange={e => set("shortDescription", e.target.value)} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="logos" className="space-y-3 mt-4">
            <p className="text-sm text-muted-foreground">
              Upload logos for each context. The full horizontal logo auto-generates favicons and PWA icons.
            </p>
            <div className="grid md:grid-cols-2 gap-3">
              {LOGO_FIELDS.map(field => (
                <AssetUploader
                  key={field.slot}
                  {...field}
                  currentUrl={rowData?.[field.field]}
                  onUploaded={invalidate}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="favicons" className="space-y-3 mt-4">
            <p className="text-sm text-muted-foreground">
              Favicon sizes 16×16, 32×32, and 48×48 are auto-generated from the full logo. Upload overrides here if needed.
            </p>
            <div className="grid md:grid-cols-2 gap-3">
              {FAVICON_FIELDS.map(field => (
                <AssetUploader
                  key={field.slot}
                  {...field}
                  currentUrl={rowData?.[field.field]}
                  onUploaded={invalidate}
                />
              ))}
            </div>
            {Boolean((row as Record<string, unknown>)?.generatedAssets) && (
              <Card className="mt-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Auto-Generated Derivatives</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                  {Object.entries(((row as Record<string, unknown>).generatedAssets as Record<string, string>) ?? {}).map(([key, url]) => (
                    url ? (
                      <div key={key} className="text-center">
                        <img src={url} alt={key} className="h-8 w-8 object-contain border rounded" loading="lazy" />
                        <p className="text-[10px] text-muted-foreground mt-1">{key}</p>
                      </div>
                    ) : null
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="seo" className="space-y-4 mt-4">
            <div className="grid gap-4">
              <div>
                <Label>Site Description</Label>
                <Textarea className="mt-1.5" rows={2} defaultValue={merged.metaDescriptionTemplate ?? ""} onChange={e => set("metaDescriptionTemplate", e.target.value)} />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Keywords</Label>
                  <Input className="mt-1.5" defaultValue={merged.seoKeywords ?? ""} onChange={e => set("seoKeywords", e.target.value)} placeholder="car detailing, wash, solar cleaning" />
                </div>
                <div>
                  <Label>Author</Label>
                  <Input className="mt-1.5" defaultValue={merged.seoAuthor ?? ""} onChange={e => set("seoAuthor", e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Meta Title Template</Label>
                <Input className="mt-1.5" placeholder="{brand} | {tagline}" defaultValue={merged.metaTitleTemplate ?? ""} onChange={e => set("metaTitleTemplate", e.target.value)} />
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
            <div className="grid md:grid-cols-2 gap-3">
              {SEO_FIELDS.map(field => (
                <AssetUploader
                  key={field.slot}
                  {...field}
                  currentUrl={rowData?.[field.field]}
                  onUploaded={invalidate}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="theme" className="space-y-4 mt-4">
            <div className="grid sm:grid-cols-2 gap-4">
              {([
                ["primaryColor", "Primary"],
                ["secondaryColor", "Secondary"],
                ["accentColor", "Accent"],
                ["backgroundColor", "Background"],
                ["textColor", "Text"],
              ] as const).map(([key, label]) => (
                <div key={key}>
                  <Label>{label}</Label>
                  <div className="flex gap-2 mt-1.5">
                    <Input type="color" className="w-14 h-10 p-1" defaultValue={merged[key] ?? "#00cccc"} onChange={e => set(key, e.target.value)} />
                    <Input defaultValue={merged[key] ?? ""} onChange={e => set(key, e.target.value)} />
                  </div>
                </div>
              ))}
            </div>
            <Card>
              <CardContent className="p-4 mt-2">
                <p className="text-sm font-medium mb-3">Live Theme Preview</p>
                <div className="flex flex-wrap gap-3">
                  <button type="button" className="px-4 py-2 rounded-md text-white text-sm font-medium" style={{ backgroundColor: merged.primaryColor ?? "#00cccc" }}>
                    Primary Button
                  </button>
                  <button type="button" className="px-4 py-2 rounded-md text-sm font-medium border" style={{ color: merged.primaryColor ?? "#00cccc", borderColor: merged.primaryColor ?? "#00cccc" }}>
                    Outline Button
                  </button>
                  <a href="#" className="text-sm underline" style={{ color: merged.primaryColor ?? "#00cccc" }} onClick={e => e.preventDefault()}>
                    Link Text
                  </a>
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: merged.accentColor ?? "#e0ffff" }}>
                    <div className="h-full w-2/3 rounded-full" style={{ backgroundColor: merged.primaryColor ?? "#00cccc" }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="loader" className="space-y-4 mt-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Loading Text</Label>
                <Input className="mt-1.5" defaultValue={merged.loaderText ?? "Loading…"} onChange={e => set("loaderText", e.target.value)} />
              </div>
              <div>
                <Label>Loader Background Color</Label>
                <div className="flex gap-2 mt-1.5">
                  <Input type="color" className="w-14 h-10 p-1" defaultValue={merged.loaderBackgroundColor ?? merged.backgroundColor ?? "#ffffff"} onChange={e => set("loaderBackgroundColor", e.target.value)} />
                  <Input defaultValue={merged.loaderBackgroundColor ?? ""} onChange={e => set("loaderBackgroundColor", e.target.value)} />
                </div>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {LOADER_FIELDS.map(field => (
                <AssetUploader
                  key={field.slot}
                  {...field}
                  currentUrl={rowData?.[field.field]}
                  onUploaded={invalidate}
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
