import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Globe, Map, FileCode, Save, ExternalLink, Info } from "lucide-react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

interface SeoSettings {
  id: number;
  siteTitle: string;
  siteDescription: string;
  metaKeywords?: string | null;
  canonicalDomain: string;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImage?: string | null;
  twitterCardType?: string | null;
  twitterTitle?: string | null;
  twitterDescription?: string | null;
  robotsIndex: boolean;
  robotsFollow: boolean;
  robotsAdditionalRules?: string | null;
  updatedAt: string;
}

async function apiGet(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiPut(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon size={14} className="text-primary" />
        </div>
        <h2 className="font-display font-bold text-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function SeoSettingsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<SeoSettings>({
    queryKey: ["seo-settings"],
    queryFn: () => apiGet("/api/seo-settings"),
    staleTime: 60_000,
  });

  const [form, setForm] = useState({
    siteTitle: "",
    siteDescription: "",
    metaKeywords: "",
    canonicalDomain: "https://cwpdetailers.in",
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    twitterCardType: "summary_large_image",
    twitterTitle: "",
    twitterDescription: "",
    robotsIndex: true,
    robotsFollow: true,
    robotsAdditionalRules: "",
  });

  useEffect(() => {
    if (settings) {
      setForm({
        siteTitle: settings.siteTitle ?? "",
        siteDescription: settings.siteDescription ?? "",
        metaKeywords: settings.metaKeywords ?? "",
        canonicalDomain: settings.canonicalDomain ?? "https://cwpdetailers.in",
        ogTitle: settings.ogTitle ?? "",
        ogDescription: settings.ogDescription ?? "",
        ogImage: settings.ogImage ?? "",
        twitterCardType: settings.twitterCardType ?? "summary_large_image",
        twitterTitle: settings.twitterTitle ?? "",
        twitterDescription: settings.twitterDescription ?? "",
        robotsIndex: settings.robotsIndex !== false,
        robotsFollow: settings.robotsFollow !== false,
        robotsAdditionalRules: settings.robotsAdditionalRules ?? "",
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiPut("/api/admin/seo-settings", {
        ...form,
        metaKeywords: form.metaKeywords || null,
        ogTitle: form.ogTitle || null,
        ogDescription: form.ogDescription || null,
        ogImage: form.ogImage || null,
        twitterTitle: form.twitterTitle || null,
        twitterDescription: form.twitterDescription || null,
        robotsAdditionalRules: form.robotsAdditionalRules || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seo-settings"] });
      toast({ title: "Saved", description: "SEO settings updated. Sitemap and robots.txt will reflect changes immediately." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const f = (k: keyof typeof form) => ({
    value: form[k] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value })),
  });

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center py-20">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">SEO Management</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Control site-wide SEO, Open Graph, Twitter Cards, robots.txt, and sitemap.xml.
            </p>
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2">
            <Save size={15} />
            {saveMutation.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </div>

        {/* Info */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-start gap-3">
          <Info size={15} className="text-primary mt-0.5 flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            Changes here automatically update <strong className="text-foreground">sitemap.xml</strong>,{" "}
            <strong className="text-foreground">robots.txt</strong>, and{" "}
            <strong className="text-foreground">schema.org markup</strong>. No deployment needed.
          </p>
        </div>

        {/* Quick links */}
        <div className="flex gap-3 flex-wrap">
          <a
            href={`${form.canonicalDomain || ""}/sitemap.xml`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary border border-primary/20 px-3 py-1.5 rounded-full hover:bg-primary/10 transition-colors"
          >
            <Map size={11} /> View sitemap.xml <ExternalLink size={10} />
          </a>
          <a
            href={`${form.canonicalDomain || ""}/robots.txt`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary border border-primary/20 px-3 py-1.5 rounded-full hover:bg-primary/10 transition-colors"
          >
            <FileCode size={11} /> View robots.txt <ExternalLink size={10} />
          </a>
          <a
            href="/api/schema/local-business"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary border border-primary/20 px-3 py-1.5 rounded-full hover:bg-primary/10 transition-colors"
          >
            <FileCode size={11} /> LocalBusiness Schema <ExternalLink size={10} />
          </a>
        </div>

        {/* General SEO */}
        <Section icon={Search} title="General SEO">
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1">
                Site Title{" "}
                <span className={form.siteTitle.length > 60 ? "text-red-500" : "text-muted-foreground/60"}>
                  ({form.siteTitle.length}/60)
                </span>
              </Label>
              <Input {...f("siteTitle")} placeholder="CWP Detailers And Motors — Professional Car Detailing in Varanasi" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">
                Site Description{" "}
                <span className={form.siteDescription.length > 160 ? "text-red-500" : "text-muted-foreground/60"}>
                  ({form.siteDescription.length}/160)
                </span>
              </Label>
              <Textarea {...f("siteDescription")} rows={3} placeholder="Professional car wash, vehicle detailing, ceramic coating..." />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Meta Keywords (comma separated)</Label>
              <Input {...f("metaKeywords")} placeholder="car wash Varanasi, vehicle detailing, ceramic coating" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Canonical Domain *</Label>
              <Input {...f("canonicalDomain")} placeholder="https://cwpdetailers.in" type="url" />
              <p className="text-xs text-muted-foreground mt-1">Used in sitemap.xml and all canonical URL references.</p>
            </div>
          </div>
        </Section>

        {/* Open Graph */}
        <Section icon={Globe} title="Open Graph (Social Sharing)">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1">OG Title</Label>
                <Input {...f("ogTitle")} placeholder="Falls back to Site Title" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1">OG Image URL</Label>
                <Input {...f("ogImage")} placeholder="https://..." type="url" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">OG Description</Label>
              <Textarea {...f("ogDescription")} rows={2} placeholder="Falls back to Site Description" />
            </div>
          </div>
        </Section>

        {/* Twitter Card */}
        <Section icon={Globe} title="Twitter / X Card">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Card Type</Label>
              <select
                value={form.twitterCardType}
                onChange={e => setForm(prev => ({ ...prev, twitterCardType: e.target.value }))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="summary_large_image">summary_large_image</option>
                <option value="summary">summary</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Twitter Title</Label>
              <Input {...f("twitterTitle")} placeholder="Falls back to OG Title or Site Title" />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs text-muted-foreground mb-1">Twitter Description</Label>
              <Textarea {...f("twitterDescription")} rows={2} placeholder="Falls back to OG Description or Site Description" />
            </div>
          </div>
        </Section>

        {/* Robots */}
        <Section icon={FileCode} title="Robots & Indexing">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Allow Search Engine Indexing</p>
                <p className="text-xs text-muted-foreground">Disabling this sends noindex to all pages.</p>
              </div>
              <Switch
                checked={form.robotsIndex}
                onCheckedChange={v => setForm(prev => ({ ...prev, robotsIndex: v }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Allow Search Engine Following</p>
                <p className="text-xs text-muted-foreground">Disabling sends nofollow for all links.</p>
              </div>
              <Switch
                checked={form.robotsFollow}
                onCheckedChange={v => setForm(prev => ({ ...prev, robotsFollow: v }))}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Additional robots.txt Rules</Label>
              <Textarea
                {...f("robotsAdditionalRules")}
                rows={4}
                className="font-mono text-sm"
                placeholder={"# Custom rules\nCrawl-delay: 10"}
              />
              <p className="text-xs text-muted-foreground mt-1">
                These are appended to the auto-generated robots.txt. Admin, API, and portal paths are auto-excluded.
              </p>
            </div>
          </div>
        </Section>

        {/* Save */}
        <div className="flex justify-end">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} size="lg" className="gap-2">
            <Save size={16} />
            {saveMutation.isPending ? "Saving..." : "Save All SEO Settings"}
          </Button>
        </div>

        {settings?.updatedAt && (
          <p className="text-xs text-muted-foreground text-right">
            Last updated: {new Date(settings.updatedAt).toLocaleString("en-IN")}
          </p>
        )}
      </div>
    </AdminLayout>
  );
}
