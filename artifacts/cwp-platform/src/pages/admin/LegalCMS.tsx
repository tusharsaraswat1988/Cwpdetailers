import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText, Eye, Edit3, Clock, Globe, EyeOff, RotateCcw,
  CheckCircle, AlertCircle, ChevronDown, ChevronUp, ExternalLink,
} from "lucide-react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface LegalPage {
  id: number;
  slug: string;
  title: string;
  status: "draft" | "published";
  content: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoKeywords?: string | null;
  canonicalUrl?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  lastUpdatedBy?: string | null;
  publishedAt?: string | null;
  updatedAt: string;
}

interface LegalPageVersion {
  id: number;
  pageId: number;
  slug: string;
  title: string;
  content: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  savedBy?: string | null;
  createdAt: string;
}

const PAGE_LABELS: Record<string, string> = {
  "privacy-policy": "Privacy Policy",
  "terms-and-conditions": "Terms & Conditions",
  "refund-policy": "Refund & Cancellation Policy",
  "data-deletion": "Data Deletion Policy",
  "about-us": "About Us",
  "contact-us": "Contact Us",
};

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

async function apiPost(url: string) {
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Simple Rich-Text Toolbar (formats text area with HTML tags)
function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [tab, setTab] = useState<"edit" | "preview">("edit");

  const insertTag = (open: string, close: string) => {
    const ta = document.getElementById("rte-textarea") as HTMLTextAreaElement | null;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.substring(start, end);
    const newVal = value.substring(0, start) + open + selected + close + value.substring(end);
    onChange(newVal);
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = start + open.length;
      ta.selectionEnd = start + open.length + selected.length;
    }, 0);
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-1 px-3 py-2 bg-muted/30 border-b border-border flex-wrap">
        <button type="button" onClick={() => insertTag("<h2>", "</h2>")}
          className="px-2 py-1 text-xs font-bold text-foreground hover:bg-muted rounded transition-colors">H2</button>
        <button type="button" onClick={() => insertTag("<h3>", "</h3>")}
          className="px-2 py-1 text-xs font-bold text-foreground hover:bg-muted rounded transition-colors">H3</button>
        <div className="w-px h-4 bg-border mx-1" />
        <button type="button" onClick={() => insertTag("<strong>", "</strong>")}
          className="px-2 py-1 text-xs font-bold text-foreground hover:bg-muted rounded transition-colors">B</button>
        <button type="button" onClick={() => insertTag("<em>", "</em>")}
          className="px-2 py-1 text-xs italic text-foreground hover:bg-muted rounded transition-colors">I</button>
        <div className="w-px h-4 bg-border mx-1" />
        <button type="button" onClick={() => insertTag("<ul>\n  <li>", "</li>\n</ul>")}
          className="px-2 py-1 text-xs text-foreground hover:bg-muted rounded transition-colors">UL</button>
        <button type="button" onClick={() => insertTag("<ol>\n  <li>", "</li>\n</ol>")}
          className="px-2 py-1 text-xs text-foreground hover:bg-muted rounded transition-colors">OL</button>
        <button type="button" onClick={() => insertTag("<li>", "</li>")}
          className="px-2 py-1 text-xs text-foreground hover:bg-muted rounded transition-colors">LI</button>
        <div className="w-px h-4 bg-border mx-1" />
        <button type="button" onClick={() => insertTag("<p>", "</p>")}
          className="px-2 py-1 text-xs text-foreground hover:bg-muted rounded transition-colors">P</button>
        <button type="button" onClick={() => insertTag('<a href="">', "</a>")}
          className="px-2 py-1 text-xs text-foreground hover:bg-muted rounded transition-colors">Link</button>
        <div className="flex-1" />
        <div className="flex rounded-md overflow-hidden border border-border">
          <button type="button" onClick={() => setTab("edit")}
            className={cn("px-3 py-1 text-xs transition-colors", tab === "edit" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
            Edit
          </button>
          <button type="button" onClick={() => setTab("preview")}
            className={cn("px-3 py-1 text-xs transition-colors", tab === "preview" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
            Preview
          </button>
        </div>
      </div>

      {tab === "edit" ? (
        <textarea
          id="rte-textarea"
          className="w-full min-h-[400px] p-4 bg-background text-foreground text-sm font-mono resize-y focus:outline-none"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Write HTML content here..."
        />
      ) : (
        <div
          className="min-h-[400px] p-4 prose prose-neutral dark:prose-invert max-w-none text-sm"
          dangerouslySetInnerHTML={{ __html: value }}
        />
      )}
    </div>
  );
}

// ─── Editor Panel ─────────────────────────────────────────────────────────────

function PageEditor({ page, onClose }: { page: LegalPage; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: page.title,
    content: page.content,
    seoTitle: page.seoTitle ?? "",
    seoDescription: page.seoDescription ?? "",
    seoKeywords: page.seoKeywords ?? "",
    canonicalUrl: page.canonicalUrl ?? "",
    ogTitle: page.ogTitle ?? "",
    ogDescription: page.ogDescription ?? "",
  });
  const [seoExpanded, setSeoExpanded] = useState(false);
  const [versionsVisible, setVersionsVisible] = useState(false);

  const saveMutation = useMutation({
    mutationFn: (data: typeof form & { status?: string }) =>
      apiPut(`/api/admin/legal/pages/${page.slug}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-legal-pages"] });
      qc.invalidateQueries({ queryKey: ["admin-legal-page", page.slug] });
      toast({ title: "Saved", description: "Page saved as draft." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      await apiPut(`/api/admin/legal/pages/${page.slug}`, { ...form, status: "published" });
      return apiPost(`/api/admin/legal/pages/${page.slug}/publish`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-legal-pages"] });
      toast({ title: "Published", description: "Page is now live." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const unpublishMutation = useMutation({
    mutationFn: () => apiPost(`/api/admin/legal/pages/${page.slug}/unpublish`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-legal-pages"] });
      toast({ title: "Unpublished", description: "Page set to draft." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const { data: versions } = useQuery<LegalPageVersion[]>({
    queryKey: ["legal-versions", page.slug],
    queryFn: () => apiGet(`/api/admin/legal/pages/${page.slug}/versions`),
    enabled: versionsVisible,
  });

  const restoreMutation = useMutation({
    mutationFn: (versionId: number) =>
      apiPost(`/api/admin/legal/pages/${page.slug}/restore/${versionId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-legal-pages"] });
      qc.invalidateQueries({ queryKey: ["legal-versions", page.slug] });
      toast({ title: "Restored", description: "Previous version restored." });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const field = (k: keyof typeof form) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value })),
  });

  const isBusy = saveMutation.isPending || publishMutation.isPending || unpublishMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm transition-colors">
            ← Back
          </button>
          <span className="text-border">/</span>
          <p className="font-display font-bold text-foreground">{page.title}</p>
          <Badge variant={page.status === "published" ? "default" : "secondary"} className="text-xs">
            {page.status === "published" ? "Published" : "Draft"}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open(`/${page.slug}`, "_blank")} className="gap-1.5 text-xs">
            <ExternalLink size={13} /> Preview Live
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={() => setVersionsVisible(v => !v)}
            className="gap-1.5 text-xs"
          >
            <Clock size={13} /> History
          </Button>
          {page.status === "published" ? (
            <Button
              variant="outline" size="sm"
              onClick={() => unpublishMutation.mutate()}
              disabled={isBusy}
              className="gap-1.5 text-xs"
            >
              <EyeOff size={13} /> Unpublish
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => publishMutation.mutate()}
              disabled={isBusy}
              className="gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white"
            >
              <Globe size={13} /> Publish
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => saveMutation.mutate(form)}
            disabled={isBusy}
            className="gap-1.5 text-xs"
          >
            {saveMutation.isPending ? "Saving..." : "Save Draft"}
          </Button>
        </div>
      </div>

      {/* Version history panel */}
      {versionsVisible && (
        <div className="bg-muted/30 border border-border rounded-lg p-4">
          <p className="text-sm font-semibold text-foreground mb-3">Version History (last 50)</p>
          {!versions ? (
            <p className="text-muted-foreground text-xs">Loading...</p>
          ) : versions.length === 0 ? (
            <p className="text-muted-foreground text-xs">No previous versions saved yet.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {versions.map(v => (
                <div key={v.id} className="flex items-center justify-between gap-3 bg-background rounded-lg px-3 py-2 border border-border">
                  <div>
                    <p className="text-xs font-medium text-foreground">{v.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(v.createdAt).toLocaleString("en-IN")}
                      {v.savedBy && ` · by ${v.savedBy}`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs gap-1 h-7"
                    onClick={() => restoreMutation.mutate(v.id)}
                    disabled={restoreMutation.isPending}
                  >
                    <RotateCcw size={11} /> Restore
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Title */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1">Page Title</Label>
        <Input {...field("title")} className="font-display font-bold text-lg h-auto py-2" />
      </div>

      {/* Content */}
      <div>
        <Label className="text-xs text-muted-foreground mb-2">Content</Label>
        <RichTextEditor value={form.content} onChange={v => setForm(prev => ({ ...prev, content: v }))} />
      </div>

      {/* SEO Section (collapsible) */}
      <div className="border border-border rounded-lg overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors"
          onClick={() => setSeoExpanded(v => !v)}
        >
          <span className="text-sm font-semibold text-foreground">SEO & Open Graph Settings</span>
          {seoExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {seoExpanded && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1">SEO Title</Label>
                <Input {...field("seoTitle")} placeholder="Page title for search engines" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1">Canonical URL</Label>
                <Input {...field("canonicalUrl")} placeholder="https://cwpdetailers.in/privacy-policy" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">SEO Description</Label>
              <Textarea {...field("seoDescription")} rows={2} placeholder="Meta description for search results (150-160 chars)" />
              <p className="text-xs text-muted-foreground mt-1">{form.seoDescription.length} / 160 chars</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">SEO Keywords (comma separated)</Label>
              <Input {...field("seoKeywords")} placeholder="car wash, vehicle detailing, Varanasi" />
            </div>
            <hr className="border-border" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Open Graph</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1">OG Title</Label>
                <Input {...field("ogTitle")} placeholder="Open Graph title" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1">OG Description</Label>
                <Input {...field("ogDescription")} placeholder="Open Graph description" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Meta */}
      {page.lastUpdatedBy && (
        <p className="text-xs text-muted-foreground">
          Last saved by {page.lastUpdatedBy} · {new Date(page.updatedAt).toLocaleString("en-IN")}
        </p>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LegalCMS() {
  const [editingSlug, setEditingSlug] = useState<string | null>(null);

  const { data: pages, isLoading } = useQuery<LegalPage[]>({
    queryKey: ["admin-legal-pages"],
    queryFn: () => apiGet("/api/admin/legal/pages"),
    staleTime: 30_000,
  });

  const { data: editingPage } = useQuery<LegalPage>({
    queryKey: ["admin-legal-page", editingSlug],
    queryFn: () => apiGet(`/api/admin/legal/pages/${editingSlug}`),
    enabled: !!editingSlug,
  });

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        {editingSlug && editingPage ? (
          <PageEditor page={editingPage} onClose={() => setEditingSlug(null)} />
        ) : (
          <>
            {/* Header */}
            <div>
              <h1 className="font-display font-bold text-2xl text-foreground">Legal & Compliance Pages</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Manage all public legal pages. Changes take effect immediately after publishing.
              </p>
            </div>

            {/* Notice */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle size={16} className="text-primary mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-foreground">CMS-Driven Content</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  All content is stored in the database. No code changes or redeployment needed.
                  Publish updated pages in under 2 minutes.
                </p>
              </div>
            </div>

            {/* Page List */}
            {isLoading ? (
              <div className="flex justify-center py-10">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(pages ?? []).map(page => (
                  <div
                    key={page.slug}
                    className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <FileText size={15} className="text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-sm">{page.title}</p>
                          <p className="text-muted-foreground text-xs">/{page.slug}</p>
                        </div>
                      </div>
                      <Badge
                        className={cn(
                          "text-xs shrink-0",
                          page.status === "published"
                            ? "bg-green-500/15 text-green-600 border-green-500/20"
                            : "bg-amber-500/15 text-amber-600 border-amber-500/20",
                        )}
                        variant="outline"
                      >
                        {page.status === "published" ? (
                          <><CheckCircle size={10} className="mr-1" />Published</>
                        ) : (
                          <><AlertCircle size={10} className="mr-1" />Draft</>
                        )}
                      </Badge>
                    </div>

                    <div className="text-xs text-muted-foreground mb-4">
                      {page.lastUpdatedBy && <span>By {page.lastUpdatedBy} · </span>}
                      {new Date(page.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        className="gap-1.5 text-xs flex-1"
                        onClick={() => setEditingSlug(page.slug)}
                      >
                        <Edit3 size={12} /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs"
                        onClick={() => window.open(`/${page.slug}`, "_blank")}
                      >
                        <Eye size={12} /> View
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
