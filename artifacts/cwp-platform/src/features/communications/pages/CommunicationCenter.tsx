import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  commApi, type AudienceFilterNode, type CommTemplate, type CommCampaign,
} from "../api";
import {
  MessageSquare, Send, Users, Zap, BarChart3, Shield, Server,
  Plus, Play, Clock, CheckCircle2, XCircle, Eye, Radio, Target, Ban, IndianRupee,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import CampaignDetailDialog from "../components/CampaignDetailDialog";

const CHANNELS = [
  { id: "sms", label: "SMS" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "email", label: "Email" },
  { id: "push", label: "Push" },
  { id: "in_app", label: "In-App" },
];

const TEMPLATE_CATEGORIES = [
  "transactional", "promotional", "service_implicit", "otp", "utility",
];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-500/10 text-blue-600",
  processing: "bg-yellow-500/10 text-yellow-600",
  sent: "bg-green-500/10 text-green-600",
  failed: "bg-red-500/10 text-red-600",
};

function StatCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: typeof Send }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon size={18} className="text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="font-display font-bold text-xl">{typeof value === "number" ? value.toLocaleString("en-IN") : value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CommunicationCenter() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [detailCampaignId, setDetailCampaignId] = useState<number | null>(null);

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["comm-analytics"],
    queryFn: () => commApi.getAnalytics(30),
  });
  const { data: templates } = useQuery({ queryKey: ["comm-templates"], queryFn: commApi.getTemplates });
  const { data: audiences } = useQuery({ queryKey: ["comm-audiences"], queryFn: commApi.getAudiences });
  const { data: campaigns, refetch: refetchCampaigns } = useQuery({ queryKey: ["comm-campaigns"], queryFn: commApi.getCampaigns });
  const { data: automations } = useQuery({ queryKey: ["comm-automations"], queryFn: commApi.getAutomations });
  const { data: entities } = useQuery({ queryKey: ["comm-dlt-entities"], queryFn: commApi.getDltEntities });
  const { data: headers } = useQuery({ queryKey: ["comm-dlt-headers"], queryFn: commApi.getDltHeaders });
  const { data: providers } = useQuery({ queryKey: ["comm-providers"], queryFn: commApi.getProviders });
  const { data: filterOptions } = useQuery({ queryKey: ["comm-filters"], queryFn: commApi.getAudienceFilters });
  const { data: triggers } = useQuery({ queryKey: ["comm-triggers"], queryFn: commApi.getAutomationTriggers });
  const { data: variables } = useQuery({ queryKey: ["comm-vars"], queryFn: commApi.getTemplateVariables });
  const { data: brands } = useQuery({ queryKey: ["comm-brands"], queryFn: commApi.getBrands });
  const { data: workflows } = useQuery({ queryKey: ["comm-workflows"], queryFn: () => commApi.getWorkflows() });
  const { data: emailTemplates } = useQuery({ queryKey: ["comm-email-templates"], queryFn: () => commApi.getEmailTemplates() });
  const { data: waTemplates } = useQuery({ queryKey: ["comm-wa-templates"], queryFn: () => commApi.getWhatsappTemplates() });
  const { data: queueStats } = useQuery({ queryKey: ["comm-queue-stats"], queryFn: commApi.getQueueStats });

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl flex items-center gap-2">
              <Radio className="text-primary" size={24} />
              Communication Center
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              SMS, WhatsApp, Email, Push & In-App — unified messaging hub
            </p>
          </div>
          <div className="flex gap-2">
            {CHANNELS.map(ch => (
              <Badge key={ch.id} variant="outline" className="text-xs">{ch.label}</Badge>
            ))}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" className="gap-1.5"><BarChart3 size={14} />Overview</TabsTrigger>
            <TabsTrigger value="campaigns" className="gap-1.5"><Send size={14} />Campaigns</TabsTrigger>
            <TabsTrigger value="audiences" className="gap-1.5"><Users size={14} />Audiences</TabsTrigger>
            <TabsTrigger value="templates" className="gap-1.5"><MessageSquare size={14} />Templates</TabsTrigger>
            <TabsTrigger value="dlt" className="gap-1.5"><Shield size={14} />DLT</TabsTrigger>
            <TabsTrigger value="providers" className="gap-1.5"><Server size={14} />Providers</TabsTrigger>
            <TabsTrigger value="automations" className="gap-1.5"><Zap size={14} />Automations</TabsTrigger>
            <TabsTrigger value="brands" className="gap-1.5"><Shield size={14} />Brands</TabsTrigger>
            <TabsTrigger value="workflows" className="gap-1.5"><Zap size={14} />Workflows</TabsTrigger>
            <TabsTrigger value="email-wa" className="gap-1.5"><MessageSquare size={14} />Email & WA</TabsTrigger>
          </TabsList>

          {/* ── Overview / Analytics ── */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {analyticsLoading ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />) : (
                <>
                  <StatCard label="Total Campaigns" value={analytics?.totalCampaigns ?? 0} icon={Target} />
                  <StatCard label="Messages Sent" value={analytics?.sent ?? 0} icon={Send} />
                  <StatCard label="Revenue Generated" value={`₹${(analytics?.revenue ?? 0).toLocaleString("en-IN")}`} icon={IndianRupee} />
                  <StatCard label="ROI" value={analytics?.roi ? `${analytics.roi}x` : "—"} icon={BarChart3} />
                  <StatCard label="Consent Rate" value={`${analytics?.consentRate ?? 0}%`} icon={CheckCircle2} />
                  <StatCard label="Active Automations" value={analytics?.activeAutomations ?? 0} icon={Zap} />
                </>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {!analyticsLoading && (
                <>
                  <StatCard label="Consent Blocked" value={analytics?.consentBlocked ?? 0} icon={Ban} />
                  <StatCard label="Delivered" value={analytics?.delivered ?? 0} icon={CheckCircle2} />
                  <StatCard label="Failed" value={analytics?.failed ?? 0} icon={XCircle} />
                  <StatCard label="Queue Retrying" value={queueStats?.retrying ?? 0} icon={Clock} />
                  <StatCard label="Dead Letter" value={queueStats?.deadLetter ?? 0} icon={Ban} />
                  <StatCard label="Converted" value={analytics?.converted ?? 0} icon={Eye} />
                </>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">Daily Messages</CardTitle></CardHeader>
                <CardContent>
                  {analyticsLoading ? <Skeleton className="h-48" /> : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={analytics?.dailyTrend ?? []}>
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="sent" fill="hsl(180,100%,40%)" name="Sent" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="failed" fill="hsl(0,84%,60%)" name="Failed" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm">Daily Revenue</CardTitle></CardHeader>
                <CardContent>
                  {analyticsLoading ? <Skeleton className="h-48" /> : (
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={analytics?.dailyTrend ?? []}>
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
                        <Line type="monotone" dataKey="revenue" stroke="hsl(180,100%,40%)" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">Channel Performance</CardTitle></CardHeader>
                <CardContent>
                  {analyticsLoading ? <Skeleton className="h-40" /> : (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={analytics?.channelPerformance ?? []} layout="vertical">
                        <XAxis type="number" tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="channel" width={70} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="sent" fill="hsl(180,100%,40%)" name="Sent" />
                        <Bar dataKey="failed" fill="hsl(0,84%,60%)" name="Failed" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm">Campaign ROI</CardTitle></CardHeader>
                <CardContent className="space-y-2 max-h-[200px] overflow-y-auto">
                  {(analytics?.campaignRoi ?? []).slice(0, 8).map(c => (
                    <div key={c.campaignId} className="flex justify-between text-sm p-2 rounded border">
                      <span className="truncate mr-2">{c.name}</span>
                      <span className="font-medium shrink-0">{c.roi > 0 ? `${c.roi}x` : `₹${c.revenue.toLocaleString("en-IN")}`}</span>
                    </div>
                  ))}
                  {!analytics?.campaignRoi?.length && <p className="text-sm text-muted-foreground text-center py-6">No ROI data yet</p>}
                </CardContent>
              </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">Recent Campaigns</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {(campaigns ?? []).slice(0, 5).map(c => (
                    <div key={c.id} className="flex items-center justify-between p-2 rounded-lg border cursor-pointer hover:bg-muted/50"
                      onClick={() => setDetailCampaignId(c.id)}>
                      <div>
                        <p className="text-sm font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.channel.toUpperCase()} · {c.stats?.sent ?? 0} sent</p>
                      </div>
                      <Badge className={STATUS_COLORS[c.status] ?? ""}>{c.status}</Badge>
                    </div>
                  ))}
                  {!campaigns?.length && <p className="text-sm text-muted-foreground text-center py-4">No campaigns yet</p>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm">Active Automations</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {(automations ?? []).filter(a => a.isActive).slice(0, 5).map(a => (
                    <div key={a.id} className="flex items-center justify-between p-2 rounded-lg border">
                      <div>
                        <p className="text-sm font-medium">{a.name}</p>
                        <p className="text-xs text-muted-foreground">{a.trigger.replace(/_/g, " ")} → {a.channel}</p>
                      </div>
                      <Badge variant="outline" className="text-green-600">Active</Badge>
                    </div>
                  ))}
                  {!automations?.length && <p className="text-sm text-muted-foreground text-center py-4">No automations configured</p>}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Campaigns ── */}
          <TabsContent value="campaigns" className="mt-4">
            <CampaignBuilder
              templates={templates ?? []}
              audiences={audiences ?? []}
              campaigns={campaigns ?? []}
              onRefresh={() => { refetchCampaigns(); qc.invalidateQueries({ queryKey: ["comm-analytics"] }); }}
              onViewDetail={setDetailCampaignId}
              toast={toast}
            />
          </TabsContent>

          {/* ── Audiences ── */}
          <TabsContent value="audiences" className="mt-4">
            <AudienceBuilder filterOptions={filterOptions ?? []} audiences={audiences ?? []} toast={toast} qc={qc} />
          </TabsContent>

          {/* ── Templates ── */}
          <TabsContent value="templates" className="mt-4">
            <TemplateManager templates={templates ?? []} variables={variables ?? []} toast={toast} qc={qc} />
          </TabsContent>

          {/* ── DLT ── */}
          <TabsContent value="dlt" className="mt-4 space-y-4">
            <DltManager entities={entities ?? []} headers={headers ?? []} toast={toast} qc={qc} />
          </TabsContent>

          {/* ── Providers ── */}
          <TabsContent value="providers" className="mt-4">
            <ProviderManager providers={providers ?? []} toast={toast} qc={qc} />
          </TabsContent>

          {/* ── Automations ── */}
          <TabsContent value="automations" className="mt-4">
            <AutomationManager
              automations={automations ?? []}
              templates={templates ?? []}
              triggers={triggers ?? []}
              toast={toast}
              qc={qc}
            />
          </TabsContent>

          <TabsContent value="brands" className="mt-4 space-y-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Multi-Brand Registry</CardTitle>
                <CardDescription>CWP Detailers, Kleansolar, DCC, BidWar — isolated communication per brand</CardDescription>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-3">
                {(brands ?? []).map(b => (
                  <div key={b.id} className="p-4 border rounded-lg flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ background: b.primaryColor ?? "#666" }} />
                    <div>
                      <p className="font-medium">{b.name}</p>
                      <p className="text-xs text-muted-foreground">{b.code} · {b.status}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workflows" className="mt-4 space-y-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Visual Workflows</CardTitle>
                <CardDescription>Multi-step automations: SMS → Wait → WhatsApp → Email → Task</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {(workflows ?? []).map(w => (
                  <div key={w.id} className="p-4 border rounded-lg flex justify-between">
                    <div>
                      <p className="font-medium">{w.name}</p>
                      <p className="text-xs text-muted-foreground">{w.trigger.replace(/_/g, " ")} · Brand #{w.brandId}</p>
                    </div>
                    <Badge variant={w.isActive ? "default" : "secondary"}>{w.isActive ? "Active" : "Paused"}</Badge>
                  </div>
                ))}
                {!workflows?.length && <p className="text-sm text-muted-foreground">No workflows yet. Create via API or builder.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="email-wa" className="mt-4 grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Email Templates</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {(emailTemplates ?? []).map(t => (
                  <div key={t.id} className="p-3 border rounded-lg">
                    <p className="font-medium text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.emailType} · {t.subject}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">WhatsApp Templates (Meta)</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {(waTemplates ?? []).map(t => (
                  <div key={t.id} className="p-3 border rounded-lg">
                    <p className="font-medium text-sm">{t.metaTemplateName}</p>
                    <p className="text-xs text-muted-foreground">{t.category} · {t.bodyPreview.slice(0, 80)}…</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <CampaignDetailDialog
          campaignId={detailCampaignId}
          open={detailCampaignId != null}
          onOpenChange={(open) => { if (!open) setDetailCampaignId(null); }}
        />
      </div>
    </AdminLayout>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function CampaignBuilder({
  templates, audiences, campaigns, onRefresh, onViewDetail, toast,
}: {
  templates: CommTemplate[];
  audiences: Array<{ id: number; name: string; estimatedCount?: number }>;
  campaigns: CommCampaign[];
  onRefresh: () => void;
  onViewDetail: (id: number) => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", channel: "sms", audienceId: "", templateId: "", schedule: "", testPhone: "" });
  const [preview, setPreview] = useState("");

  const createMut = useMutation({
    mutationFn: () => commApi.createCampaign({
      name: form.name,
      channel: form.channel,
      audienceId: form.audienceId ? parseInt(form.audienceId) : undefined,
      templateId: form.templateId ? parseInt(form.templateId) : undefined,
      scheduledAt: form.schedule || undefined,
    }),
    onSuccess: () => { setOpen(false); onRefresh(); toast({ title: "Campaign created" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const sendMut = useMutation({
    mutationFn: (id: number) => commApi.sendCampaign(id),
    onSuccess: (r) => { onRefresh(); toast({ title: `Sent ${r.sent}, failed ${r.failed}` }); },
    onError: (e: Error) => toast({ title: "Send failed", description: e.message, variant: "destructive" }),
  });

  const previewMut = useMutation({
    mutationFn: (body: string) => commApi.previewMessage(body),
    onSuccess: (r) => setPreview(r.body),
  });

  const selectedTemplate = templates.find(t => String(t.id) === form.templateId);

  const testWaMut = useMutation({
    mutationFn: () => commApi.testWhatsApp({
      phone: form.testPhone,
      templateBody: selectedTemplate!.body,
      templateName: selectedTemplate!.dltTemplateId ?? selectedTemplate!.name,
    }),
    onSuccess: (r) => toast({
      title: r.success ? "WhatsApp test sent" : "Test failed",
      description: r.success ? r.renderedMessage : r.error,
      variant: r.success ? "default" : "destructive",
    }),
    onError: (e: Error) => toast({ title: "Test failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-semibold">Campaign Builder</h2>
          <p className="text-sm text-muted-foreground">Select channel, audience, template — send now or schedule</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-secondary"><Plus size={15} className="mr-1.5" />New Campaign</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create Campaign</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Channel</Label>
                  <Select value={form.channel} onValueChange={v => setForm(f => ({ ...f, channel: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{CHANNELS.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Audience</Label>
                  <Select value={form.audienceId} onValueChange={v => setForm(f => ({ ...f, audienceId: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select audience" /></SelectTrigger>
                    <SelectContent>{audiences.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name} ({a.estimatedCount ?? 0})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Template</Label>
                <Select value={form.templateId} onValueChange={v => setForm(f => ({ ...f, templateId: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select template" /></SelectTrigger>
                  <SelectContent>{templates.filter(t => t.channel === form.channel || form.channel === "in_app").map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}</SelectContent>
                </Select>
              </div>
              {selectedTemplate && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <Label>Preview</Label>
                    <Button variant="ghost" size="sm" onClick={() => previewMut.mutate(selectedTemplate.body)}><Eye size={14} className="mr-1" />Preview</Button>
                  </div>
                  <div className="p-3 rounded-lg bg-muted text-sm">{preview || selectedTemplate.body}</div>
                </div>
              )}
              {form.channel === "whatsapp" && selectedTemplate && (
                <div className="space-y-2 pt-2 border-t">
                  <Label>Test WhatsApp Send</Label>
                  <div className="flex gap-2">
                    <Input placeholder="Phone (10 digits)" value={form.testPhone}
                      onChange={e => setForm(f => ({ ...f, testPhone: e.target.value }))} />
                    <Button variant="outline" onClick={() => testWaMut.mutate()}
                      disabled={!form.testPhone || testWaMut.isPending}>Test</Button>
                  </div>
                </div>
              )}
              <div>
                <Label>Schedule (optional)</Label>
                <Input type="datetime-local" value={form.schedule} onChange={e => setForm(f => ({ ...f, schedule: e.target.value }))} className="mt-1" />
              </div>
              <Button onClick={() => createMut.mutate()} disabled={createMut.isPending || !form.name || !form.templateId} className="w-full">
                {form.schedule ? <><Clock size={14} className="mr-1.5" />Schedule Campaign</> : <><Send size={14} className="mr-1.5" />Save as Draft</>}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {campaigns.map(c => (
          <Card key={c.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {c.channel.toUpperCase()} · {c.stats?.sent ?? 0} sent · {c.stats?.failed ?? 0} failed
                  {c.scheduledAt && ` · Scheduled ${new Date(c.scheduledAt).toLocaleString("en-IN")}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={STATUS_COLORS[c.status] ?? ""}>{c.status}</Badge>
                <Button size="sm" variant="outline" onClick={() => onViewDetail(c.id)}><Eye size={14} /></Button>
                {(c.status === "draft" || c.status === "scheduled") && (
                  <Button size="sm" onClick={() => sendMut.mutate(c.id)} disabled={sendMut.isPending}>
                    <Play size={14} className="mr-1" />Send Now
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {!campaigns.length && <p className="text-center text-muted-foreground py-8">No campaigns yet. Create your first campaign above.</p>}
      </div>
    </div>
  );
}

function AudienceBuilder({
  filterOptions, audiences, toast, qc,
}: {
  filterOptions: Array<{ id: string; label: string; group: string }>;
  audiences: Array<{ id: number; name: string; estimatedCount?: number; filterDefinition?: AudienceFilterNode }>;
  toast: ReturnType<typeof useToast>["toast"];
  qc: ReturnType<typeof useQueryClient>;
}) {
  const [audienceTab, setAudienceTab] = useState<"filters" | "segments">("filters");
  const [name, setName] = useState("");
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [selectedSegment, setSelectedSegment] = useState<string>("");
  const [operator, setOperator] = useState<"AND" | "OR">("AND");
  const [previewCount, setPreviewCount] = useState<number | null>(null);

  const { data: smartSegments } = useQuery({
    queryKey: ["comm-smart-segments"],
    queryFn: commApi.getSmartSegments,
  });

  const buildFilterDef = (): AudienceFilterNode => {
    if (audienceTab === "segments" && selectedSegment) {
      if (selectedFilters.length) {
        return {
          type: "group",
          operator,
          children: [
            { type: "smart_segment", segmentKey: selectedSegment },
            ...selectedFilters.map(f => ({ type: "filter" as const, filter: f })),
          ],
        };
      }
      return { type: "smart_segment", segmentKey: selectedSegment };
    }
    if (selectedFilters.length === 1) return { type: "filter", filter: selectedFilters[0]! };
    return {
      type: "group",
      operator,
      children: selectedFilters.map(f => ({ type: "filter" as const, filter: f })),
    };
  };

  const previewMut = useMutation({
    mutationFn: () => {
      if (audienceTab === "segments" && selectedSegment && !selectedFilters.length) {
        return commApi.previewSmartSegment(selectedSegment);
      }
      return commApi.previewAudience(buildFilterDef());
    },
    onSuccess: (r) => setPreviewCount(r.count),
    onError: (e: Error) => toast({ title: "Preview failed", description: e.message, variant: "destructive" }),
  });

  const createMut = useMutation({
    mutationFn: () => commApi.createAudience({ name, filterDefinition: buildFilterDef() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comm-audiences"] });
      setName(""); setSelectedFilters([]); setSelectedSegment(""); setPreviewCount(null);
      toast({ title: "Audience saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const grouped = filterOptions.reduce((acc, f) => {
    (acc[f.group] ??= []).push(f);
    return acc;
  }, {} as Record<string, typeof filterOptions>);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Build Audience</CardTitle>
          <CardDescription>Use filters or smart segments with AND/OR</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={audienceTab} onValueChange={v => setAudienceTab(v as "filters" | "segments")}>
            <TabsList className="w-full">
              <TabsTrigger value="filters" className="flex-1">Custom Filters</TabsTrigger>
              <TabsTrigger value="segments" className="flex-1">Smart Segments</TabsTrigger>
            </TabsList>
          </Tabs>

          <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} className="mt-1" placeholder="e.g. High value — no visit 30d" /></div>

          {audienceTab === "segments" && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {(smartSegments ?? []).map(seg => (
                <div key={seg.segmentKey}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedSegment === seg.segmentKey ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                  onClick={() => setSelectedSegment(seg.segmentKey)}>
                  <p className="text-sm font-medium">{seg.name}</p>
                  <p className="text-xs text-muted-foreground">{seg.description}</p>
                  {seg.isSystem && <Badge variant="outline" className="text-[10px] mt-1">System</Badge>}
                </div>
              ))}
            </div>
          )}

          {audienceTab === "filters" && Object.entries(grouped).map(([group, filters]) => (
            <div key={group}>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">{group}</p>
              <div className="flex flex-wrap gap-2">
                {filters.map(f => (
                  <Badge
                    key={f.id}
                    variant={selectedFilters.includes(f.id) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setSelectedFilters(prev =>
                      prev.includes(f.id) ? prev.filter(x => x !== f.id) : [...prev, f.id],
                    )}
                  >
                    {f.label}
                  </Badge>
                ))}
              </div>
            </div>
          ))}

          {audienceTab === "segments" && selectedSegment && (
            <div>
              <Label className="text-xs">Combine segment with filters (optional)</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {filterOptions.slice(0, 8).map(f => (
                  <Badge key={f.id} variant={selectedFilters.includes(f.id) ? "default" : "outline"}
                    className="cursor-pointer text-xs"
                    onClick={() => setSelectedFilters(prev =>
                      prev.includes(f.id) ? prev.filter(x => x !== f.id) : [...prev, f.id],
                    )}>
                    {f.label}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {previewCount !== null && (
            <p className="text-sm font-medium text-primary">{previewCount.toLocaleString("en-IN")} recipients match</p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => previewMut.mutate()}
              disabled={(audienceTab === "filters" ? !selectedFilters.length : !selectedSegment) || previewMut.isPending}>
              <Eye size={14} className="mr-1" />Preview Count
            </Button>
            <Button onClick={() => createMut.mutate()} disabled={!name || createMut.isPending
              || (audienceTab === "filters" ? !selectedFilters.length : !selectedSegment)}>
              Save Audience
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Saved Audiences</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {audiences.map(a => (
            <div key={a.id} className="p-3 rounded-lg border flex justify-between">
              <div>
                <p className="font-medium text-sm">{a.name}</p>
                <p className="text-xs text-muted-foreground">{a.estimatedCount?.toLocaleString("en-IN") ?? "—"} recipients</p>
              </div>
              <Users size={16} className="text-muted-foreground" />
            </div>
          ))}
          {!audiences.length && <p className="text-sm text-muted-foreground text-center py-6">No saved audiences</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function TemplateManager({
  templates, variables, toast, qc,
}: {
  templates: CommTemplate[];
  variables: Array<{ key: string; placeholder: string }>;
  toast: ReturnType<typeof useToast>["toast"];
  qc: ReturnType<typeof useQueryClient>;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", channel: "sms", category: "transactional", body: "", dltTemplateId: "", subject: "" });

  const createMut = useMutation({
    mutationFn: () => commApi.createTemplate(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comm-templates"] });
      setOpen(false);
      toast({ title: "Template created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <div>
          <h2 className="font-semibold">Message Templates</h2>
          <p className="text-sm text-muted-foreground">DLT-approved templates with dynamic variables</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus size={15} className="mr-1.5" />New Template</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Template</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Channel</Label>
                  <Select value={form.channel} onValueChange={v => setForm(f => ({ ...f, channel: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{CHANNELS.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{TEMPLATE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              {form.channel === "sms" && (
                <div><Label>DLT Template ID</Label><Input value={form.dltTemplateId} onChange={e => setForm(f => ({ ...f, dltTemplateId: e.target.value }))} className="mt-1" /></div>
              )}
              {form.channel === "email" && (
                <div><Label>Subject</Label><Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className="mt-1" /></div>
              )}
              <div>
                <Label>Body</Label>
                <Textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} className="mt-1 min-h-[100px]" />
                <div className="flex flex-wrap gap-1 mt-2">
                  {variables.map(v => (
                    <Badge key={v.key} variant="outline" className="text-xs cursor-pointer"
                      onClick={() => setForm(f => ({ ...f, body: f.body + v.placeholder }))}>
                      {v.placeholder}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button onClick={() => createMut.mutate()} disabled={!form.name || !form.body || createMut.isPending} className="w-full">Create Template</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {templates.map(t => (
          <Card key={t.id}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <p className="font-medium">{t.name}</p>
                <div className="flex gap-1">
                  <Badge variant="outline">{t.channel}</Badge>
                  <Badge variant="secondary">{t.category.replace(/_/g, " ")}</Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">{t.body}</p>
              {t.dltTemplateId && <p className="text-xs text-muted-foreground mt-1">DLT: {t.dltTemplateId}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function DltManager({
  entities, headers, toast, qc,
}: {
  entities: Array<{ id: number; name: string; entityId: string; isActive: boolean }>;
  headers: Array<{ id: number; entityId: number; headerId: string; name: string }>;
  toast: ReturnType<typeof useToast>["toast"];
  qc: ReturnType<typeof useQueryClient>;
}) {
  const [entityForm, setEntityForm] = useState({ name: "", entityId: "" });
  const [headerForm, setHeaderForm] = useState({ entityId: "", headerId: "", name: "" });

  const createEntity = useMutation({
    mutationFn: () => commApi.createDltEntity(entityForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["comm-dlt-entities"] }); setEntityForm({ name: "", entityId: "" }); toast({ title: "Entity added" }); },
  });
  const createHeader = useMutation({
    mutationFn: () => commApi.createDltHeader({ ...headerForm, entityId: parseInt(headerForm.entityId) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["comm-dlt-headers"] }); setHeaderForm({ entityId: "", headerId: "", name: "" }); toast({ title: "Header added" }); },
  });

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle className="text-sm">DLT Entities</CardTitle><CardDescription>Registered Principal Entity IDs</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {entities.map(e => (
            <div key={e.id} className="p-3 border rounded-lg flex justify-between">
              <div><p className="font-medium text-sm">{e.name}</p><p className="text-xs text-muted-foreground font-mono">{e.entityId}</p></div>
              <Badge variant={e.isActive ? "default" : "secondary"}>{e.isActive ? "Active" : "Inactive"}</Badge>
            </div>
          ))}
          <div className="pt-3 border-t space-y-2">
            <Input placeholder="Entity name" value={entityForm.name} onChange={e => setEntityForm(f => ({ ...f, name: e.target.value }))} />
            <Input placeholder="Entity ID (PE ID)" value={entityForm.entityId} onChange={e => setEntityForm(f => ({ ...f, entityId: e.target.value }))} />
            <Button size="sm" onClick={() => createEntity.mutate()} disabled={!entityForm.name || !entityForm.entityId}>Add Entity</Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">DLT Headers</CardTitle><CardDescription>Approved sender headers</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {headers.map(h => (
            <div key={h.id} className="p-3 border rounded-lg">
              <p className="font-medium text-sm">{h.name}</p>
              <p className="text-xs text-muted-foreground font-mono">{h.headerId}</p>
            </div>
          ))}
          <div className="pt-3 border-t space-y-2">
            <Select value={headerForm.entityId} onValueChange={v => setHeaderForm(f => ({ ...f, entityId: v }))}>
              <SelectTrigger><SelectValue placeholder="Select entity" /></SelectTrigger>
              <SelectContent>{entities.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Header ID" value={headerForm.headerId} onChange={e => setHeaderForm(f => ({ ...f, headerId: e.target.value }))} />
            <Input placeholder="Header name" value={headerForm.name} onChange={e => setHeaderForm(f => ({ ...f, name: e.target.value }))} />
            <Button size="sm" onClick={() => createHeader.mutate()} disabled={!headerForm.entityId || !headerForm.headerId}>Add Header</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ProviderManager({
  providers, toast, qc,
}: {
  providers: Array<{ id: number; name: string; providerType: string; channel: string; isActive: boolean; isPrimary: boolean }>;
  toast: ReturnType<typeof useToast>["toast"];
  qc: ReturnType<typeof useQueryClient>;
}) {
  const [form, setForm] = useState({ name: "", providerType: "fast2sms", channel: "sms", apiKey: "", senderId: "" });

  const createMut = useMutation({
    mutationFn: () => commApi.createProvider({
      name: form.name, providerType: form.providerType, channel: form.channel,
      config: { apiKey: form.apiKey, senderId: form.senderId },
      isPrimary: providers.length === 0,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["comm-providers"] }); toast({ title: "Provider added" }); },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">SMS Provider Management</CardTitle>
          <CardDescription>Switch providers without code changes. Fast2SMS supported; MSG91, Resend, WhatsApp ready.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {providers.map(p => (
            <div key={p.id} className="p-4 border rounded-lg flex justify-between items-center">
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.providerType} · {p.channel}</p>
              </div>
              <div className="flex gap-2">
                {p.isPrimary && <Badge>Primary</Badge>}
                <Badge variant={p.isActive ? "default" : "secondary"}>{p.isActive ? "Active" : "Inactive"}</Badge>
              </div>
            </div>
          ))}
          {!providers.length && (
            <p className="text-sm text-muted-foreground">No DB providers configured. Falls back to env vars (FAST2SMS_API_KEY).</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Add Provider</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3">
          <Input placeholder="Display name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <Select value={form.providerType} onValueChange={v => setForm(f => ({ ...f, providerType: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="fast2sms">Fast2SMS</SelectItem>
              <SelectItem value="msg91">MSG91</SelectItem>
              <SelectItem value="resend">Resend (Email)</SelectItem>
              <SelectItem value="whatsapp_business">WhatsApp Business</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="API Key" value={form.apiKey} onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))} type="password" />
          <Input placeholder="Sender ID" value={form.senderId} onChange={e => setForm(f => ({ ...f, senderId: e.target.value }))} />
          <Button onClick={() => createMut.mutate()} disabled={!form.name} className="md:col-span-2">Add Provider</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function AutomationManager({
  automations, templates, triggers, toast, qc,
}: {
  automations: Array<{ id: number; name: string; trigger: string; channel: string; templateId: number; isActive: boolean }>;
  templates: CommTemplate[];
  triggers: Array<{ id: string; label: string }>;
  toast: ReturnType<typeof useToast>["toast"];
  qc: ReturnType<typeof useQueryClient>;
}) {
  const [form, setForm] = useState({ name: "", trigger: "payment_due", channel: "sms", templateId: "" });

  const createMut = useMutation({
    mutationFn: () => commApi.createAutomation({
      name: form.name, trigger: form.trigger, channel: form.channel,
      templateId: parseInt(form.templateId),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["comm-automations"] }); toast({ title: "Automation created" }); },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Trigger-Based Automations</CardTitle>
          <CardDescription>Automatic messages on payment due, wash due, package expiry, and more</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3">
          <Input placeholder="Automation name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <Select value={form.trigger} onValueChange={v => setForm(f => ({ ...f, trigger: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{triggers.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={form.channel} onValueChange={v => setForm(f => ({ ...f, channel: v }))}>
            <SelectTrigger><SelectValue placeholder="Channel" /></SelectTrigger>
            <SelectContent>{CHANNELS.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={form.templateId} onValueChange={v => setForm(f => ({ ...f, templateId: v }))}>
            <SelectTrigger><SelectValue placeholder="Template" /></SelectTrigger>
            <SelectContent>{templates.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={() => createMut.mutate()} disabled={!form.name || !form.templateId} className="md:col-span-2">
            <Zap size={14} className="mr-1.5" />Create Automation
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {automations.map(a => (
          <div key={a.id} className="p-4 border rounded-lg flex justify-between items-center">
            <div>
              <p className="font-medium">{a.name}</p>
              <p className="text-xs text-muted-foreground">{a.trigger.replace(/_/g, " ")} → {a.channel.toUpperCase()}</p>
            </div>
            <Badge variant={a.isActive ? "default" : "secondary"}>{a.isActive ? "Active" : "Paused"}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
