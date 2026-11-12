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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
} from "lucide-react";

export type PromotionItem = {
  id: number;
  title: string;
  subtitle?: string | null;
  bannerType: "first_party" | "third_party" | "announcement";
  placement: string;
  cityId?: number | null;
  cityName?: string | null;
  serviceId?: number | null;
  serviceName?: string | null;
  badgeText?: string | null;
  imageUrl?: string | null;
  mobileImageUrl?: string | null;
  ctaText?: string | null;
  ctaLink?: string | null;
  highlights?: string[] | null;
  advertiserName?: string | null;
  advertiserContact?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isActive: boolean;
  sortOrder: number;
  clickCount: number;
  impressionCount: number;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

type City = {
  id: number;
  name: string;
  slug: string;
};

const PROMOTIONS_QUERY_KEY = ["promotions", "admin"];
const CITIES_QUERY_KEY = ["masters", "cities"];

const emptyForm = () => ({
  title: "",
  subtitle: "",
  bannerType: "first_party" as "first_party" | "third_party" | "announcement",
  placement: "home_hero",
  cityId: "global",
  serviceId: "",
  badgeText: "",
  imageUrl: "",
  mobileImageUrl: "",
  ctaText: "Explore Now",
  ctaLink: "/customer/schedule",
  highlightsText: "Zero Scratches\n100% RO Water\nDoorstep Convenience",
  advertiserName: "",
  startDate: "",
  endDate: "",
  isActive: true,
  sortOrder: 0,
});

export function PromotionsManager() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromotionItem | null>(null);
  const [formData, setFormData] = useState(emptyForm());
  const [deleteTarget, setDeleteTarget] = useState<PromotionItem | null>(null);

  // Filter state
  const [placementFilter, setPlacementFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");

  // Fetch Cities
  const { data: cities = [] } = useQuery<City[]>({
    queryKey: CITIES_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/masters/cities", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch Admin Promotions
  const { data: promoData, isLoading } = useQuery<{ promotions: PromotionItem[] }>({
    queryKey: PROMOTIONS_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/promotions/admin", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load promotions");
      return res.json();
    },
  });

  // Save (Create/Update) Mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: ReturnType<typeof emptyForm> & { id?: number }) => {
      const isEdit = Boolean(payload.id);
      const url = isEdit ? `/api/promotions/${payload.id}` : "/api/promotions";
      const method = isEdit ? "PATCH" : "POST";

      const highlights = payload.highlightsText
        ? payload.highlightsText.split("\n").map(s => s.trim()).filter(Boolean)
        : [];

      const body = {
        title: payload.title,
        subtitle: payload.subtitle || null,
        bannerType: payload.bannerType,
        placement: payload.placement,
        cityId: payload.cityId === "global" ? null : parseInt(payload.cityId, 10),
        serviceId: payload.serviceId ? parseInt(payload.serviceId, 10) : null,
        badgeText: payload.badgeText || null,
        imageUrl: payload.imageUrl || null,
        mobileImageUrl: payload.mobileImageUrl || null,
        ctaText: payload.ctaText || null,
        ctaLink: payload.ctaLink || null,
        highlights,
        advertiserName: payload.advertiserName || null,
        startDate: payload.startDate ? new Date(payload.startDate).toISOString() : null,
        endDate: payload.endDate ? new Date(payload.endDate).toISOString() : null,
        isActive: payload.isActive,
        sortOrder: Number(payload.sortOrder) || 0,
      };

      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save promotion");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROMOTIONS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: ["promotions"] });
      setDialogOpen(false);
      setEditingPromo(null);
      toast({
        title: editingPromo ? "Campaign Updated" : "Campaign Created",
        description: "Promotional banner changes are live immediately.",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/promotions/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete promotion");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROMOTIONS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: ["promotions"] });
      setDeleteTarget(null);
      toast({ title: "Campaign deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  // Toggle active state
  const toggleActive = (promo: PromotionItem) => {
    saveMutation.mutate({
      ...emptyForm(),
      id: promo.id,
      title: promo.title,
      bannerType: promo.bannerType,
      placement: promo.placement,
      cityId: promo.cityId ? String(promo.cityId) : "global",
      isActive: !promo.isActive,
    });
  };

  const handleOpenAdd = () => {
    setEditingPromo(null);
    setFormData(emptyForm());
    setDialogOpen(true);
  };

  const handleOpenEdit = (promo: PromotionItem) => {
    setEditingPromo(promo);
    setFormData({
      title: promo.title,
      subtitle: promo.subtitle || "",
      bannerType: promo.bannerType,
      placement: promo.placement,
      cityId: promo.cityId ? String(promo.cityId) : "global",
      serviceId: promo.serviceId ? String(promo.serviceId) : "",
      badgeText: promo.badgeText || "",
      imageUrl: promo.imageUrl || "",
      mobileImageUrl: promo.mobileImageUrl || "",
      ctaText: promo.ctaText || "Explore Now",
      ctaLink: promo.ctaLink || "/customer/schedule",
      highlightsText: (promo.highlights || []).join("\n"),
      advertiserName: promo.advertiserName || "",
      startDate: promo.startDate ? promo.startDate.slice(0, 10) : "",
      endDate: promo.endDate ? promo.endDate.slice(0, 10) : "",
      isActive: promo.isActive,
      sortOrder: promo.sortOrder,
    });
    setDialogOpen(true);
  };

  const promotions = promoData?.promotions ?? [];

  const filteredPromotions = promotions.filter(p => {
    if (placementFilter !== "all" && p.placement !== placementFilter) return false;
    if (cityFilter !== "all") {
      if (cityFilter === "global" && p.cityId != null) return false;
      if (cityFilter !== "global" && String(p.cityId) !== cityFilter) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6" data-testid="promotions-manager">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Megaphone className="text-primary" size={22} />
            Promotions, Banners & Ad Engine
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure dynamic homepage hero banners, city-targeted marketing offers, and future third-party advertisements.
          </p>
        </div>
        <Button onClick={handleOpenAdd} data-testid="btn-add-promotion">
          <Plus size={16} className="mr-1.5" /> Create Campaign
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 bg-muted/40 p-3 rounded-xl border border-border">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Placement:</span>
          <select
            value={placementFilter}
            onChange={e => setPlacementFilter(e.target.value)}
            className="text-xs bg-background border border-border rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Placements</option>
            <option value="home_hero">Homepage Hero</option>
            <option value="home_secondary">Home Secondary</option>
            <option value="booking_flow">Booking Flow</option>
            <option value="checkout">Checkout</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Target City:</span>
          <select
            value={cityFilter}
            onChange={e => setCityFilter(e.target.value)}
            className="text-xs bg-background border border-border rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Cities & Global</option>
            <option value="global">Global Fallback Only</option>
            {cities.map(c => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Campaign Cards List */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : filteredPromotions.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <Megaphone className="mx-auto mb-2 text-muted-foreground/60" size={32} />
          <p className="font-medium">No campaigns found for the selected filters.</p>
          <p className="text-xs">Create a new promotion or clear the filters.</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredPromotions.map(promo => {
            const ctr = promo.impressionCount > 0
              ? ((promo.clickCount / promo.impressionCount) * 100).toFixed(1)
              : "0.0";

            return (
              <Card key={promo.id} className="relative overflow-hidden transition-all hover:border-primary/40">
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base font-bold">{promo.title}</CardTitle>
                        <Badge variant={promo.bannerType === "third_party" ? "outline" : "default"}>
                          {promo.bannerType === "third_party"
                            ? `Sponsored (${promo.advertiserName || "Ad"})`
                            : promo.bannerType === "announcement"
                            ? "Announcement"
                            : "First Party Offer"}
                        </Badge>
                        <Badge variant="secondary" className="gap-1 font-mono text-[11px]">
                          <Layers size={10} />
                          {promo.placement}
                        </Badge>
                        {promo.cityId ? (
                          <Badge variant="outline" className="border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300 gap-1">
                            <MapPin size={11} />
                            {promo.cityName || `City #${promo.cityId}`}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground text-[11px]">
                            Global / All Cities
                          </Badge>
                        )}
                        {!promo.isActive && (
                          <Badge variant="destructive">Inactive</Badge>
                        )}
                      </div>

                      {promo.badgeText && (
                        <p className="text-xs font-semibold text-primary pt-0.5">
                          Badge: "{promo.badgeText}"
                        </p>
                      )}
                      {promo.subtitle && (
                        <CardDescription className="text-xs pt-1 max-w-2xl">
                          {promo.subtitle}
                        </CardDescription>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={promo.isActive}
                        onCheckedChange={() => toggleActive(promo)}
                        title="Toggle campaign active state"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEdit(promo)}
                        className="text-xs"
                      >
                        <Pencil size={12} className="mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(promo)}
                        className="text-xs text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="text-xs space-y-3 pt-0">
                  {/* Highlights list */}
                  {(promo.highlights || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {promo.highlights?.map((h, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-muted/60 border border-border text-[11px]"
                        >
                          • {h}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Analytics & CTR metrics bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/30 p-2.5 rounded-lg border border-border/60">
                    <div className="flex flex-wrap items-center gap-4 text-muted-foreground font-mono">
                      <span className="flex items-center gap-1">
                        <Eye size={12} />
                        Impressions: <strong className="text-foreground">{promo.impressionCount.toLocaleString("en-IN")}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <MousePointerClick size={12} />
                        Clicks: <strong className="text-foreground">{promo.clickCount.toLocaleString("en-IN")}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp size={12} className="text-emerald-500" />
                        CTR: <strong className="text-emerald-600 dark:text-emerald-400">{ctr}%</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {promo.ctaLink && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          CTA: <strong className="text-foreground">{promo.ctaText || "Click"}</strong> → {promo.ctaLink}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Campaign Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPromo ? "Edit Promotional Campaign" : "Create Promotional Campaign"}
            </DialogTitle>
            <DialogDescription>
              Configure city-targeted marketing hero banners or third-party advertisements.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div>
              <Label>Campaign Title</Label>
              <Input
                value={formData.title}
                onChange={e => setFormData(f => ({ ...f, title: e.target.value }))}
                placeholder="Showroom Shine at Your Doorstep, Every Single Morning."
                className="mt-1"
              />
            </div>

            <div>
              <Label>Subtitle / Description</Label>
              <Textarea
                value={formData.subtitle}
                onChange={e => setFormData(f => ({ ...f, subtitle: e.target.value }))}
                placeholder="Detailed copy describing the service value proposition..."
                className="mt-1 min-h-[70px] text-xs"
              />
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <Label>Campaign Type</Label>
                <Select
                  value={formData.bannerType}
                  onValueChange={v => setFormData(f => ({ ...f, bannerType: v as any }))}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="first_party">First Party (CWP)</SelectItem>
                    <SelectItem value="third_party">Third Party (Sponsored Ad)</SelectItem>
                    <SelectItem value="announcement">Announcement / Alert</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Placement Slot</Label>
                <Select
                  value={formData.placement}
                  onValueChange={v => setFormData(f => ({ ...f, placement: v }))}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="home_hero">Homepage Hero Banner</SelectItem>
                    <SelectItem value="home_secondary">Home Middle Section</SelectItem>
                    <SelectItem value="booking_flow">Booking Flow</SelectItem>
                    <SelectItem value="checkout">Checkout Nudge</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Target City</Label>
                <Select
                  value={formData.cityId}
                  onValueChange={v => setFormData(f => ({ ...f, cityId: v }))}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global (All Cities Fallback)</SelectItem>
                    {cities.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.bannerType === "third_party" && (
              <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg">
                <Label>Advertiser / Sponsor Name</Label>
                <Input
                  value={formData.advertiserName}
                  onChange={e => setFormData(f => ({ ...f, advertiserName: e.target.value }))}
                  placeholder="e.g. Michelin Tyres or HDFC Bank"
                  className="mt-1"
                />
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Badge Text (Top Pill)</Label>
                <Input
                  value={formData.badgeText}
                  onChange={e => setFormData(f => ({ ...f, badgeText: e.target.value }))}
                  placeholder="e.g. Noida's #1 Doorstep Daily Cleaning"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Display Priority (Sort Order)</Label>
                <Input
                  type="number"
                  value={formData.sortOrder}
                  onChange={e => setFormData(f => ({ ...f, sortOrder: parseInt(e.target.value, 10) || 0 }))}
                  placeholder="0 (Lower numbers appear first)"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>CTA Button Text</Label>
                <Input
                  value={formData.ctaText}
                  onChange={e => setFormData(f => ({ ...f, ctaText: e.target.value }))}
                  placeholder="e.g. Explore Daily Cleaning Plans"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>CTA Link / Destination</Label>
                <Input
                  value={formData.ctaLink}
                  onChange={e => setFormData(f => ({ ...f, ctaLink: e.target.value }))}
                  placeholder="e.g. /customer/plans"
                  className="mt-1 font-mono text-xs"
                />
              </div>
            </div>

            <div>
              <Label>Value Pillars / Highlights (One per line)</Label>
              <Textarea
                value={formData.highlightsText}
                onChange={e => setFormData(f => ({ ...f, highlightsText: e.target.value }))}
                placeholder="Zero Scratches&#10;100% RO Water&#10;Basement Parking Service"
                className="mt-1 min-h-[70px] text-xs font-mono"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Campaign Start Date</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={e => setFormData(f => ({ ...f, startDate: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Campaign End Date</Label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={e => setFormData(f => ({ ...f, endDate: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Switch
                checked={formData.isActive}
                onCheckedChange={c => setFormData(f => ({ ...f, isActive: c }))}
                id="promo-active"
              />
              <Label htmlFor="promo-active" className="cursor-pointer">Active and displaying to customers</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate({ ...formData, id: editingPromo?.id })}
              disabled={saveMutation.isPending || !formData.title.trim()}
            >
              {saveMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              {editingPromo ? "Update Campaign" : "Publish Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete Campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete campaign <strong>"{deleteTarget?.title}"</strong>? This will permanently remove its historical impression and click metrics.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
