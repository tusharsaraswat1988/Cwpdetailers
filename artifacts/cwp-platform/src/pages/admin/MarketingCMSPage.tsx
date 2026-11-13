import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sparkles,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Calendar,
  MousePointerClick,
  Eye,
  Megaphone,
  ExternalLink,
  Layers,
  Loader2,
  TrendingUp,
  Percent,
  Tag,
  ArrowUp,
  ArrowDown,
  Copy,
  Check,
  Smartphone,
  Globe,
  FileText,
  Search,
} from "lucide-react";

type City = { id: number; name: string; slug: string };
type Branch = { id: number; name: string; cityId: number };

type Section = {
  id: number;
  sectionKey: string;
  title: string;
  subtitle?: string | null;
  cityId?: number | null;
  cityName?: string | null;
  branchId?: number | null;
  branchName?: string | null;
  isEnabled: boolean;
  sortOrder: number;
  content: Record<string, unknown>;
  scheduledPublishAt?: string | null;
  expiresAt?: string | null;
};

type Campaign = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  cityId?: number | null;
  cityName?: string | null;
  branchId?: number | null;
  branchName?: string | null;
  offerType: string;
  discountValue: string;
  minOrderAmount?: string | null;
  maxDiscountAmount?: string | null;
  usageLimit?: number | null;
  usedCount: number;
  perCustomerLimit?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  isActive: boolean;
  status: string;
  termsAndConditions?: string | null;
};

type MediaAsset = {
  id: number;
  title: string;
  altText?: string | null;
  fileUrl: string;
  thumbnailUrl?: string | null;
  fileType?: string | null;
  fileSizeBytes?: number | null;
  width?: number | null;
  height?: number | null;
  tags?: string[] | null;
  cityId?: number | null;
};

export default function MarketingCMSPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("sections");
  const [selectedCityId, setSelectedCityId] = useState<string>("all");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Queries
  const { data: citiesData } = useQuery<{ cities: City[] }>({
    queryKey: ["cities-list"],
    queryFn: async () => {
      const res = await fetch("/api/cities");
      if (!res.ok) return { cities: [] };
      return res.json();
    },
  });
  const cities = citiesData?.cities || [];

  const { data: sectionsData, isLoading: sectionsLoading } = useQuery<{ sections: Section[] }>({
    queryKey: ["marketing-sections", selectedCityId],
    queryFn: async () => {
      const url = selectedCityId !== "all" ? `/api/marketing/sections?cityId=${selectedCityId}` : "/api/marketing/sections";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return { sections: [] };
      return res.json();
    },
  });
  const sections = sectionsData?.sections || [];

  const { data: campaignsData, isLoading: campaignsLoading } = useQuery<{ campaigns: Campaign[] }>({
    queryKey: ["marketing-campaigns", selectedCityId],
    queryFn: async () => {
      const url = selectedCityId !== "all" ? `/api/marketing/campaigns?cityId=${selectedCityId}` : "/api/marketing/campaigns";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return { campaigns: [] };
      return res.json();
    },
  });
  const campaigns = campaignsData?.campaigns || [];

  const { data: mediaData } = useQuery<{ mediaAssets: MediaAsset[] }>({
    queryKey: ["marketing-media", selectedCityId],
    queryFn: async () => {
      const url = selectedCityId !== "all" ? `/api/marketing/media?cityId=${selectedCityId}` : "/api/marketing/media";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return { mediaAssets: [] };
      return res.json();
    },
  });
  const mediaAssets = mediaData?.mediaAssets || [];

  const { data: analyticsData } = useQuery<{
    overview: {
      totalImpressions: number;
      totalClicks: number;
      ctrPercent: number;
      totalCouponsApplied: number;
      totalConversions: number;
      attributedRevenue: number;
    };
    topCampaigns: Array<{ id: number; code: string; name: string; usedCount: number }>;
  }>({
    queryKey: ["marketing-analytics", selectedCityId],
    queryFn: async () => {
      const url = selectedCityId !== "all" ? `/api/marketing/analytics?cityId=${selectedCityId}` : "/api/marketing/analytics";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return { overview: { totalImpressions: 0, totalClicks: 0, ctrPercent: 0, totalCouponsApplied: 0, totalConversions: 0, attributedRevenue: 0 }, topCampaigns: [] };
      return res.json();
    },
  });

  // Section Toggle Mutation
  const toggleSectionMutation = useMutation({
    mutationFn: async ({ id, isEnabled }: { id: number; isEnabled: boolean }) => {
      const res = await fetch(`/api/marketing/sections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update section");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-sections"] });
      toast({ title: "Section Updated", description: "Homepage section visibility changed successfully." });
    },
  });

  // Reorder Sections Mutation
  const reorderMutation = useMutation({
    mutationFn: async (sectionIds: number[]) => {
      const res = await fetch("/api/marketing/sections/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionIds }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to reorder sections");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-sections"] });
      toast({ title: "Order Saved", description: "Homepage section order updated." });
    },
  });

  const handleMove = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;
    const reordered = [...sections];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    reorderMutation.mutate(reordered.map((s) => s.id));
  };

  // Section Create/Edit Dialog state
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [sectionForm, setSectionForm] = useState({
    sectionKey: "promotional_offers",
    title: "",
    subtitle: "",
    cityId: "global",
    isEnabled: true,
  });

  // Campaign Create Dialog state
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [campaignForm, setCampaignForm] = useState({
    code: "",
    name: "",
    description: "",
    cityId: "global",
    offerType: "percentage_discount",
    discountValue: "15",
    minOrderAmount: "499",
    maxDiscountAmount: "200",
    usageLimit: "500",
    terms: "Valid on online booking only.",
  });

  const createCampaignMutation = useMutation({
    mutationFn: async (payload: typeof campaignForm) => {
      const res = await fetch("/api/marketing/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          cityId: payload.cityId === "global" ? null : parseInt(payload.cityId, 10),
          discountValue: Number(payload.discountValue),
          minOrderAmount: Number(payload.minOrderAmount),
          maxDiscountAmount: payload.maxDiscountAmount ? Number(payload.maxDiscountAmount) : null,
          usageLimit: payload.usageLimit ? parseInt(payload.usageLimit, 10) : null,
        }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create campaign");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-campaigns"] });
      setCampaignDialogOpen(false);
      toast({ title: "Campaign Created", description: `Coupon code "${campaignForm.code.toUpperCase()}" is now active.` });
    },
    onError: (err: Error) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  // Media Asset Registration Dialog state
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const [mediaForm, setMediaForm] = useState({
    title: "",
    fileUrl: "",
    altText: "",
    tags: "hero, car-care",
  });

  const createMediaMutation = useMutation({
    mutationFn: async (payload: typeof mediaForm) => {
      const res = await fetch("/api/marketing/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: payload.title,
          fileUrl: payload.fileUrl,
          altText: payload.altText,
          tags: payload.tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to save media asset");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-media"] });
      setMediaDialogOpen(false);
      toast({ title: "Media Registered", description: "Asset saved in media library." });
    },
  });

  const handleCopyUrl = (url: string, id: number) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Copied", description: "Image URL copied to clipboard." });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Megaphone size={18} />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Marketing & CMS Hub</span>
          </div>
          <h1 className="font-display font-extrabold text-2xl text-foreground">
            City/Branch-Wise Marketing & Campaigns
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage dynamic homepage sections, hero banners, coupons, localized SEO, and campaign performance without code deployment.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* City Scope Filter */}
          <div className="flex items-center gap-2">
            <MapPin size={14} className="text-muted-foreground" />
            <Select value={selectedCityId} onValueChange={setSelectedCityId}>
              <SelectTrigger className="w-44 h-9 text-xs">
                <SelectValue placeholder="All India (Global)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">🏢 All India (Global)</SelectItem>
                {cities.map((city) => (
                  <SelectItem key={city.id} value={String(city.id)}>
                    📍 {city.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Simulation Preview Action */}
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1.5 text-xs font-semibold"
            onClick={() => setPreviewOpen(true)}
          >
            <Eye size={14} className="text-primary" />
            Preview Customer Experience
          </Button>
        </div>
      </div>

      {/* KPI Highlight Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3.5 bg-card shadow-2xs">
          <p className="text-[11px] font-medium text-muted-foreground">Banner Impressions</p>
          <p className="text-lg font-bold text-foreground mt-0.5">
            {(analyticsData?.overview.totalImpressions || 0).toLocaleString("en-IN")}
          </p>
        </Card>
        <Card className="p-3.5 bg-card shadow-2xs">
          <p className="text-[11px] font-medium text-muted-foreground">Banner Clicks</p>
          <p className="text-lg font-bold text-foreground mt-0.5">
            {(analyticsData?.overview.totalClicks || 0).toLocaleString("en-IN")}
          </p>
        </Card>
        <Card className="p-3.5 bg-card shadow-2xs">
          <p className="text-[11px] font-medium text-muted-foreground">Click-Through Rate</p>
          <p className="text-lg font-bold text-primary mt-0.5">
            {analyticsData?.overview.ctrPercent || 0}%
          </p>
        </Card>
        <Card className="p-3.5 bg-card shadow-2xs">
          <p className="text-[11px] font-medium text-muted-foreground">Coupons Applied</p>
          <p className="text-lg font-bold text-indigo-600 mt-0.5">
            {(analyticsData?.overview.totalCouponsApplied || 0).toLocaleString("en-IN")}
          </p>
        </Card>
        <Card className="p-3.5 bg-card shadow-2xs">
          <p className="text-[11px] font-medium text-muted-foreground">Campaign Conversions</p>
          <p className="text-lg font-bold text-emerald-600 mt-0.5">
            {(analyticsData?.overview.totalConversions || 0).toLocaleString("en-IN")}
          </p>
        </Card>
        <Card className="p-3.5 bg-card shadow-2xs">
          <p className="text-[11px] font-medium text-muted-foreground">Attributed Revenue</p>
          <p className="text-lg font-bold text-foreground mt-0.5">
            ₹{(analyticsData?.overview.attributedRevenue || 0).toLocaleString("en-IN")}
          </p>
        </Card>
      </div>

      {/* Main Workspace Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/60 p-1 rounded-xl">
          <TabsTrigger value="sections" className="text-xs font-semibold gap-1.5">
            <Layers size={14} /> Homepage Sections
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="text-xs font-semibold gap-1.5">
            <Tag size={14} /> Campaigns & Coupons
          </TabsTrigger>
          <TabsTrigger value="landing" className="text-xs font-semibold gap-1.5">
            <Globe size={14} /> City Landing & SEO
          </TabsTrigger>
          <TabsTrigger value="media" className="text-xs font-semibold gap-1.5">
            <FileText size={14} /> Media Library
          </TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs font-semibold gap-1.5">
            <TrendingUp size={14} /> Campaign Analytics
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Homepage Sections */}
        <TabsContent value="sections" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-foreground">Configured Homepage Sections</h3>
              <p className="text-xs text-muted-foreground">
                Sections are evaluated hierarchically: Branch Override &gt; City Override &gt; Global Default.
              </p>
            </div>
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs font-semibold"
              onClick={() => {
                setEditingSection(null);
                setSectionForm({
                  sectionKey: "promotional_offers",
                  title: "",
                  subtitle: "",
                  cityId: selectedCityId,
                  isEnabled: true,
                });
                setSectionDialogOpen(true);
              }}
            >
              <Plus size={13} /> Add Custom Section
            </Button>
          </div>

          {sectionsLoading ? (
            <div className="p-12 text-center text-xs text-muted-foreground">Loading sections...</div>
          ) : sections.length === 0 ? (
            <div className="p-12 text-center border border-dashed rounded-2xl bg-card">
              <p className="text-sm font-semibold text-foreground">No custom sections configured</p>
              <p className="text-xs text-muted-foreground mt-1">Default global layout applies automatically.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sections.map((section, idx) => (
                <div
                  key={section.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-card shadow-2xs hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-md bg-muted text-muted-foreground text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">{section.title || section.sectionKey}</span>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {section.sectionKey}
                        </Badge>
                        {section.cityName ? (
                          <Badge variant="secondary" className="text-[10px]">
                            📍 {section.cityName}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            🌐 Global
                          </Badge>
                        )}
                      </div>
                      {section.subtitle && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{section.subtitle}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 mr-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={idx === 0}
                        onClick={() => handleMove(idx, "up")}
                      >
                        <ArrowUp size={13} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={idx === sections.length - 1}
                        onClick={() => handleMove(idx, "down")}
                      >
                        <ArrowDown size={13} />
                      </Button>
                    </div>

                    <div className="flex items-center gap-1.5 pl-2 border-l border-border">
                      <Switch
                        checked={section.isEnabled}
                        onCheckedChange={(checked) =>
                          toggleSectionMutation.mutate({ id: section.id, isEnabled: checked })
                        }
                      />
                      <span className="text-[11px] text-muted-foreground w-14">
                        {section.isEnabled ? "Active" : "Disabled"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Campaigns & Coupons */}
        <TabsContent value="campaigns" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-foreground">Marketing Campaigns & Promotional Coupons</h3>
              <p className="text-xs text-muted-foreground">
                Authoritative backend coupon codes, discount percentage/flat limits, and scope restrictions.
              </p>
            </div>
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs font-semibold"
              onClick={() => setCampaignDialogOpen(true)}
            >
              <Plus size={13} /> Create New Campaign
            </Button>
          </div>

          {campaignsLoading ? (
            <div className="p-12 text-center text-xs text-muted-foreground">Loading campaigns...</div>
          ) : campaigns.length === 0 ? (
            <div className="p-12 text-center border border-dashed rounded-2xl bg-card">
              <p className="text-sm font-semibold text-foreground">No active campaigns</p>
              <p className="text-xs text-muted-foreground mt-1">Create a coupon code (e.g. WELCOME50) to start promotions.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {campaigns.map((camp) => (
                <Card key={camp.id} className="p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-md bg-primary/10 text-primary font-mono font-bold text-xs">
                      {camp.code}
                    </span>
                    <Badge variant={camp.isActive ? "default" : "secondary"} className="text-[10px]">
                      {camp.status}
                    </Badge>
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-foreground">{camp.name}</h4>
                    {camp.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{camp.description}</p>
                    )}
                  </div>

                  <div className="p-2.5 rounded-lg bg-muted/40 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Benefit:</span>
                      <span className="font-bold text-foreground">
                        {camp.offerType === "percentage_discount" ? `${camp.discountValue}% OFF` : `₹${camp.discountValue} FLAT`}
                      </span>
                    </div>
                    {camp.minOrderAmount && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Min Order:</span>
                        <span>₹{camp.minOrderAmount}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Redemptions:</span>
                      <span>
                        {camp.usedCount} {camp.usageLimit ? `/ ${camp.usageLimit}` : "used"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border">
                    <span>{camp.cityName ? `📍 ${camp.cityName}` : "🌐 All Cities"}</span>
                    <span>{camp.endDate ? `Ends ${new Date(camp.endDate).toLocaleDateString()}` : "Ongoing"}</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab 3: City Landing & SEO */}
        <TabsContent value="landing" className="space-y-4">
          <Card className="p-5 shadow-2xs space-y-4">
            <div>
              <h3 className="font-bold text-sm text-foreground">City Landing Page Directory & SEO</h3>
              <p className="text-xs text-muted-foreground">
                Public landing pages live at <code>/:citySlug</code> with dynamic meta tags, localized FAQs, and Phase 19 service catalogs.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cities.map((city) => (
                <div
                  key={city.id}
                  className="p-4 rounded-xl border border-border bg-card flex items-center justify-between"
                >
                  <div>
                    <h4 className="font-bold text-sm text-foreground">{city.name} Landing Page</h4>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">/{city.slug}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`/${city.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold shadow-2xs hover:bg-primary/90"
                    >
                      Visit Page <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Tab 4: Media Library */}
        <TabsContent value="media" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-foreground">Marketing Media Assets</h3>
              <p className="text-xs text-muted-foreground">
                Reusable Cloudinary assets for hero banners, section backgrounds, and marketing campaigns.
              </p>
            </div>
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs font-semibold"
              onClick={() => setMediaDialogOpen(true)}
            >
              <Plus size={13} /> Add Media Asset
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {mediaAssets.map((asset) => (
              <Card key={asset.id} className="overflow-hidden shadow-2xs">
                <div className="h-32 bg-muted relative">
                  <img src={asset.fileUrl} alt={asset.altText || asset.title} className="w-full h-full object-cover" />
                </div>
                <div className="p-3 space-y-2">
                  <p className="font-bold text-xs text-foreground truncate">{asset.title}</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {asset.width && asset.height ? `${asset.width}x${asset.height}` : "Optimized"}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[10px] gap-1 px-2"
                      onClick={() => handleCopyUrl(asset.fileUrl, asset.id)}
                    >
                      {copiedId === asset.id ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                      {copiedId === asset.id ? "Copied" : "Copy URL"}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tab 5: Analytics */}
        <TabsContent value="analytics" className="space-y-4">
          <Card className="p-5 shadow-2xs space-y-4">
            <h3 className="font-bold text-sm text-foreground">Campaign Conversion Analytics</h3>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Lightweight, non-invasive event telemetry tracking impressions, clicks, coupon validations, and completed bookings.
              </p>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Customer Simulation Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone size={18} className="text-primary" /> Live Customer Experience Simulation
            </DialogTitle>
            <DialogDescription>
              Preview how customer homepage, services, and banners render for {selectedCityId === "all" ? "All India" : "the selected city"}.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border border-border p-4 bg-muted/20 space-y-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-[#0B1D36] to-[#123668] text-white space-y-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/30 text-blue-200">
                Simulated Hero Banner
              </span>
              <h3 className="font-bold text-lg">Showroom Shine at Your Doorstep</h3>
              <p className="text-xs text-slate-300">
                Doorstep vehicle care and daily cleaning by verified technicians.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card space-y-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                Active Sections in Scope:
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {sections.filter((s) => s.isEnabled).map((s) => (
                  <Badge key={s.id} variant="secondary" className="text-xs">
                    {s.title || s.sectionKey}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button size="sm" onClick={() => setPreviewOpen(false)}>
              Close Simulation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Campaign Create Dialog */}
      <Dialog open={campaignDialogOpen} onOpenChange={setCampaignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Marketing Campaign</DialogTitle>
            <DialogDescription>Configure a new coupon code and discount rules.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs">Coupon Code (e.g. FESTIVE25)</Label>
              <Input
                value={campaignForm.code}
                onChange={(e) => setCampaignForm({ ...campaignForm, code: e.target.value.toUpperCase() })}
                placeholder="FESTIVE25"
                className="font-mono uppercase text-xs h-8 mt-1"
              />
            </div>

            <div>
              <Label className="text-xs">Campaign Name</Label>
              <Input
                value={campaignForm.name}
                onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                placeholder="Monsoon Special Discount"
                className="text-xs h-8 mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Discount Type</Label>
                <Select
                  value={campaignForm.offerType}
                  onValueChange={(val) => setCampaignForm({ ...campaignForm, offerType: val })}
                >
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage_discount">Percentage (% OFF)</SelectItem>
                    <SelectItem value="flat_discount">Flat Discount (₹ OFF)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Value ({campaignForm.offerType === "percentage_discount" ? "%" : "₹"})</Label>
                <Input
                  type="number"
                  value={campaignForm.discountValue}
                  onChange={(e) => setCampaignForm({ ...campaignForm, discountValue: e.target.value })}
                  className="text-xs h-8 mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Min Order Amount (₹)</Label>
                <Input
                  type="number"
                  value={campaignForm.minOrderAmount}
                  onChange={(e) => setCampaignForm({ ...campaignForm, minOrderAmount: e.target.value })}
                  className="text-xs h-8 mt-1"
                />
              </div>

              <div>
                <Label className="text-xs">Max Discount Cap (₹)</Label>
                <Input
                  type="number"
                  value={campaignForm.maxDiscountAmount}
                  onChange={(e) => setCampaignForm({ ...campaignForm, maxDiscountAmount: e.target.value })}
                  placeholder="Optional"
                  className="text-xs h-8 mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">City Scope</Label>
              <Select
                value={campaignForm.cityId}
                onValueChange={(val) => setCampaignForm({ ...campaignForm, cityId: val })}
              >
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">🌐 All India (Global)</SelectItem>
                  {cities.map((city) => (
                    <SelectItem key={city.id} value={String(city.id)}>
                      📍 {city.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setCampaignDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={createCampaignMutation.isPending || !campaignForm.code || !campaignForm.name}
              onClick={() => createCampaignMutation.mutate(campaignForm)}
            >
              {createCampaignMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : "Save Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Media Registration Dialog */}
      <Dialog open={mediaDialogOpen} onOpenChange={setMediaDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Register Media Asset</DialogTitle>
            <DialogDescription>Store image metadata in the marketing library.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs">Asset Title</Label>
              <Input
                value={mediaForm.title}
                onChange={(e) => setMediaForm({ ...mediaForm, title: e.target.value })}
                placeholder="Hero Banner Noida"
                className="text-xs h-8 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Image File URL (Cloudinary / CDN)</Label>
              <Input
                value={mediaForm.fileUrl}
                onChange={(e) => setMediaForm({ ...mediaForm, fileUrl: e.target.value })}
                placeholder="https://res.cloudinary.com/..."
                className="text-xs h-8 mt-1 font-mono"
              />
            </div>
            <div>
              <Label className="text-xs">Alt Text</Label>
              <Input
                value={mediaForm.altText}
                onChange={(e) => setMediaForm({ ...mediaForm, altText: e.target.value })}
                placeholder="Doorstep car cleaning in high rise society"
                className="text-xs h-8 mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setMediaDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={createMediaMutation.isPending || !mediaForm.title || !mediaForm.fileUrl}
              onClick={() => createMediaMutation.mutate(mediaForm)}
            >
              {createMediaMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : "Save Asset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
