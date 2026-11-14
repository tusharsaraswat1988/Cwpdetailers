import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FlaskConical,
  Play,
  Pause,
  CheckCircle2,
  Trophy,
  TrendingUp,
  Percent,
  Plus,
  RefreshCw,
  Eye,
  Sliders,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface VariantMetric {
  variantId: string;
  name: string;
  weight: number;
  config: Record<string, unknown>;
  exposures: number;
  conversions: number;
  conversionRatePercent: number;
  revenue: number;
  upliftPercent: number;
  isSignificant: boolean;
  confidence: number;
}

interface Experiment {
  id: number;
  key: string;
  name: string;
  description?: string;
  targetScreen: string;
  cityId?: number | null;
  status: "draft" | "active" | "paused" | "completed";
  variants: any[];
  trafficAllocation: number;
  primaryMetric: string;
  winnerVariantId?: string | null;
  createdAt: string;
}

export function UxExperimentsDashboard() {
  const queryClient = useQueryClient();
  const [selectedExpId, setSelectedExpId] = useState<number | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newName, setNewName] = useState("");
  const [newScreen, setNewScreen] = useState("homepage");
  const [newMetric, setNewMetric] = useState("booking_confirmed");
  const [newTraffic, setNewTraffic] = useState(100);

  // List all experiments
  const { data: expData, isLoading, refetch } = useQuery<{ experiments: Experiment[] }>({
    queryKey: ["admin-ux-experiments"],
    queryFn: async () => {
      const res = await fetch("/api/admin/ux-experiments");
      if (!res.ok) throw new Error("Failed to load experiments");
      return res.json();
    },
  });

  // Query details of selected experiment
  const { data: reportData, isLoading: reportLoading } = useQuery<{
    experiment: Experiment;
    summary: { totalExposures: number; totalConversions: number; overallConversionRate: number };
    variants: VariantMetric[];
  }>({
    queryKey: ["admin-ux-experiment-report", selectedExpId],
    queryFn: async () => {
      if (!selectedExpId) return null;
      const res = await fetch(`/api/admin/ux-experiments/${selectedExpId}`);
      if (!res.ok) throw new Error("Failed to load experiment report");
      return res.json();
    },
    enabled: !!selectedExpId,
  });

  // Toggle status mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/admin/ux-experiments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ux-experiments"] });
      if (selectedExpId) queryClient.invalidateQueries({ queryKey: ["admin-ux-experiment-report", selectedExpId] });
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/ux-experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: newKey,
          name: newName,
          targetScreen: newScreen,
          primaryMetric: newMetric,
          trafficAllocation: newTraffic,
          status: "active",
          variants: [
            { id: "control", name: "Control (Default)", weight: 50, config: {} },
            { id: "variant_b", name: "Variant B (Optimized)", weight: 50, config: {} },
          ],
        }),
      });
      if (!res.ok) throw new Error("Failed to create experiment");
      return res.json();
    },
    onSuccess: () => {
      setCreateDialogOpen(false);
      setNewKey("");
      setNewName("");
      queryClient.invalidateQueries({ queryKey: ["admin-ux-experiments"] });
    },
  });

  const experiments = expData?.experiments || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-base text-foreground flex items-center gap-2">
            <FlaskConical size={18} className="text-primary" /> UX Experimentation & A/B Engine
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Run deterministic hash-partitioned variant experiments on CTAs, layouts, and booking steps.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => setCreateDialogOpen(true)}
          className="gap-1.5 self-start sm:self-auto text-xs font-semibold"
        >
          <Plus size={14} /> New Experiment
        </Button>
      </div>

      {/* Experiments List */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-3 text-center py-10 text-xs text-muted-foreground">
            Loading experiments...
          </div>
        ) : experiments.length === 0 ? (
          <Card className="col-span-3 p-8 text-center border-dashed">
            <FlaskConical className="mx-auto h-8 w-8 text-slate-400 mb-2" />
            <h4 className="font-semibold text-sm">No experiments configured yet</h4>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Create an experiment to start testing homepage CTAs, catalog views, or checkout variations.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-4 text-xs"
              onClick={() => {
                setNewKey("homepage_primary_cta");
                setNewName("Homepage Primary CTA Optimization");
                setCreateDialogOpen(true);
              }}
            >
              Seed Homepage CTA Experiment
            </Button>
          </Card>
        ) : (
          experiments.map((exp) => (
            <Card
              key={exp.id}
              onClick={() => setSelectedExpId(exp.id)}
              className={cn(
                "p-4 cursor-pointer transition-all border shadow-2xs hover:shadow-md flex flex-col justify-between",
                selectedExpId === exp.id
                  ? "border-primary ring-2 ring-primary/20 bg-blue-50/20"
                  : "border-slate-200 bg-white"
              )}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge
                    variant={exp.status === "active" ? "default" : "secondary"}
                    className={cn(
                      "text-[10px] font-bold uppercase",
                      exp.status === "active" && "bg-emerald-600"
                    )}
                  >
                    {exp.status}
                  </Badge>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {exp.trafficAllocation}% traffic
                  </span>
                </div>

                <h4 className="font-bold text-sm text-foreground">{exp.name}</h4>
                <p className="text-[11px] font-mono text-muted-foreground">key: {exp.key}</p>
                <p className="text-xs text-muted-foreground">
                  Target: <span className="font-semibold text-foreground">{exp.targetScreen}</span> · Metric: <span className="font-semibold text-foreground">{exp.primaryMetric}</span>
                </p>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-primary font-semibold flex items-center gap-1">
                  <Eye size={12} /> View Report
                </span>

                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs px-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMutation.mutate({
                      id: exp.id,
                      status: exp.status === "active" ? "paused" : "active",
                    });
                  }}
                >
                  {exp.status === "active" ? (
                    <span className="flex items-center gap-1 text-amber-600">
                      <Pause size={12} /> Pause
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <Play size={12} /> Activate
                    </span>
                  )}
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Selected Experiment Detailed Performance Report */}
      {selectedExpId && reportData && (
        <Card className="p-5 shadow-sm border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge className="bg-primary text-white text-[10px] uppercase font-bold">
                  {reportData.experiment.status}
                </Badge>
                <h4 className="font-display font-bold text-base text-foreground">
                  {reportData.experiment.name}
                </h4>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Key: <span className="font-mono">{reportData.experiment.key}</span> · Primary Metric: <span className="font-semibold">{reportData.experiment.primaryMetric}</span>
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Total Exposures</span>
                <span className="font-display font-bold text-base">{reportData.summary.totalExposures.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Total Conversions</span>
                <span className="font-display font-bold text-base text-emerald-600">{reportData.summary.totalConversions.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Overall Conv. Rate</span>
                <span className="font-display font-bold text-base text-primary">{reportData.summary.overallConversionRate}%</span>
              </div>
            </div>
          </div>

          {/* Variants Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-muted-foreground font-semibold">
                  <th className="py-2">Variant</th>
                  <th className="py-2 text-right">Weight</th>
                  <th className="py-2 text-right">Exposures</th>
                  <th className="py-2 text-right">Conversions</th>
                  <th className="py-2 text-right">Conversion Rate</th>
                  <th className="py-2 text-right">Uplift vs Control</th>
                  <th className="py-2 text-right">Significance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.variants.map((v) => (
                  <tr key={v.variantId} className="hover:bg-slate-50">
                    <td className="py-3">
                      <p className="font-bold text-foreground flex items-center gap-1.5">
                        {v.name}
                        {v.variantId === "control" && (
                          <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono">
                            baseline
                          </Badge>
                        )}
                      </p>
                      <span className="font-mono text-[10px] text-muted-foreground">{v.variantId}</span>
                    </td>
                    <td className="py-3 text-right font-mono">{v.weight}%</td>
                    <td className="py-3 text-right font-mono">{v.exposures.toLocaleString()}</td>
                    <td className="py-3 text-right font-mono text-emerald-600 font-semibold">
                      {v.conversions.toLocaleString()}
                    </td>
                    <td className="py-3 text-right font-bold text-foreground">
                      {v.conversionRatePercent}%
                    </td>
                    <td className="py-3 text-right">
                      {v.variantId === "control" ? (
                        <span className="text-muted-foreground">—</span>
                      ) : v.upliftPercent > 0 ? (
                        <span className="font-bold text-emerald-600 flex items-center justify-end gap-0.5">
                          <TrendingUp size={12} /> +{v.upliftPercent}%
                        </span>
                      ) : (
                        <span className="font-bold text-red-500">
                          {v.upliftPercent}%
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      {v.isSignificant ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                          <CheckCircle2 size={11} /> 95% Confident
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">Collecting data</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create Experiment Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create UX Experiment</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define target screen and metric. Deterministic hashing ensures users receive a consistent variant.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Experiment Key (Unique)</Label>
              <Input
                placeholder="e.g. homepage_primary_cta"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
                className="mt-1 font-mono text-xs"
              />
            </div>

            <div>
              <Label className="text-xs">Display Name</Label>
              <Input
                placeholder="e.g. Homepage Primary CTA Optimization"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="mt-1 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Target Screen</Label>
                <Select value={newScreen} onValueChange={setNewScreen}>
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="homepage">Homepage</SelectItem>
                    <SelectItem value="services">Services Catalog</SelectItem>
                    <SelectItem value="booking_flow">Booking Flow</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Primary Metric</Label>
                <Select value={newMetric} onValueChange={setNewMetric}>
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="booking_confirmed">Booking Confirmed</SelectItem>
                    <SelectItem value="checkout_started">Checkout Started</SelectItem>
                    <SelectItem value="service_selected">Service Selected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Traffic Allocation (% of total users)</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={newTraffic}
                onChange={(e) => setNewTraffic(Number(e.target.value))}
                className="mt-1 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!newKey || !newName || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              Create Experiment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
