import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { commApi, type CommWorkflow, type CommBrand } from "../api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Play, Plus, Zap } from "lucide-react";

const TRIGGERS = [
  { id: "payment_due", label: "Payment Due" },
  { id: "wash_due", label: "Wash Due" },
  { id: "amc_due", label: "AMC Due" },
  { id: "booking_completed", label: "Booking Completed" },
  { id: "lead_created", label: "Lead Created" },
];

export default function WorkflowsPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: workflows } = useQuery({ queryKey: ["comm-workflows"], queryFn: () => commApi.getWorkflows() });
  const { data: brands } = useQuery({ queryKey: ["comm-brands"], queryFn: commApi.getBrands });
  const [form, setForm] = useState({ name: "", brandId: "", trigger: "payment_due" });

  const createMut = useMutation({
    mutationFn: () => commApi.createWorkflow({
      brandId: parseInt(form.brandId),
      name: form.name,
      trigger: form.trigger,
      steps: [
        { stepOrder: 1, stepType: "send_sms", config: {} },
        { stepOrder: 2, stepType: "wait", config: { hours: 24 } },
        { stepOrder: 3, stepType: "send_whatsapp", config: {} },
      ],
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comm-workflows"] });
      toast({ title: "Workflow created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const runMut = useMutation({
    mutationFn: (id: number) => commApi.runWorkflow(id),
    onSuccess: () => toast({ title: "Workflow run queued" }),
    onError: (e: Error) => toast({ title: "Run failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><Zap size={14} />Visual Workflows</CardTitle>
          <CardDescription>Multi-step automations: SMS → Wait → WhatsApp → Email → Task</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(workflows ?? []).map((w: CommWorkflow) => (
            <div key={w.id} className="p-4 border rounded-lg flex justify-between items-center gap-3">
              <div>
                <p className="font-medium">{w.name}</p>
                <p className="text-xs text-muted-foreground">{w.trigger.replace(/_/g, " ")} · Brand #{w.brandId} · {w.steps?.length ?? 0} steps</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={w.isActive ? "default" : "secondary"}>{w.isActive ? "Active" : "Paused"}</Badge>
                <Button size="sm" variant="outline" onClick={() => runMut.mutate(w.id)} disabled={runMut.isPending}>
                  <Play size={12} className="mr-1" />Run
                </Button>
              </div>
            </div>
          ))}
          {!workflows?.length && <p className="text-sm text-muted-foreground text-center py-6">No workflows yet</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Create Workflow</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-3">
          <Input placeholder="Workflow name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <Select value={form.brandId} onValueChange={v => setForm(f => ({ ...f, brandId: v }))}>
            <SelectTrigger><SelectValue placeholder="Brand" /></SelectTrigger>
            <SelectContent>{(brands ?? []).map((b: CommBrand) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={form.trigger} onValueChange={v => setForm(f => ({ ...f, trigger: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TRIGGERS.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={() => createMut.mutate()} disabled={!form.name || !form.brandId || createMut.isPending} className="md:col-span-3">
            <Plus size={14} className="mr-1.5" />Create Workflow
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
