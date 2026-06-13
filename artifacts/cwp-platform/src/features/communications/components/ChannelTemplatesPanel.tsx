import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { commApi, type CommBrand, type CommEmailTemplate, type CommWhatsappTemplate } from "../api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

export default function ChannelTemplatesPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: brands } = useQuery({ queryKey: ["comm-brands"], queryFn: commApi.getBrands });
  const { data: emailTemplates } = useQuery({ queryKey: ["comm-email-templates"], queryFn: () => commApi.getEmailTemplates() });
  const { data: waTemplates } = useQuery({ queryKey: ["comm-wa-templates"], queryFn: () => commApi.getWhatsappTemplates() });

  const [emailForm, setEmailForm] = useState({ brandId: "", name: "", subject: "", htmlContent: "", emailType: "transactional" });
  const [waForm, setWaForm] = useState({ brandId: "", metaTemplateName: "", category: "utility", bodyPreview: "" });

  const createEmail = useMutation({
    mutationFn: () => commApi.createEmailTemplate({
      brandId: parseInt(emailForm.brandId),
      name: emailForm.name,
      subject: emailForm.subject,
      htmlContent: emailForm.htmlContent,
      emailType: emailForm.emailType,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["comm-email-templates"] }); toast({ title: "Email template created" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createWa = useMutation({
    mutationFn: () => commApi.createWhatsappTemplate({
      brandId: parseInt(waForm.brandId),
      metaTemplateName: waForm.metaTemplateName,
      category: waForm.category,
      bodyPreview: waForm.bodyPreview,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["comm-wa-templates"] }); toast({ title: "WhatsApp template registered" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Email Templates</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(emailTemplates ?? []).map((t: CommEmailTemplate) => (
            <div key={t.id} className="p-3 border rounded-lg">
              <p className="font-medium text-sm">{t.name}</p>
              <p className="text-xs text-muted-foreground">{t.emailType} · {t.subject}</p>
            </div>
          ))}
          <div className="pt-3 border-t space-y-2">
            <Select value={emailForm.brandId} onValueChange={v => setEmailForm(f => ({ ...f, brandId: v }))}>
              <SelectTrigger><SelectValue placeholder="Brand" /></SelectTrigger>
              <SelectContent>{(brands ?? []).map((b: CommBrand) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Template name" value={emailForm.name} onChange={e => setEmailForm(f => ({ ...f, name: e.target.value }))} />
            <Input placeholder="Subject" value={emailForm.subject} onChange={e => setEmailForm(f => ({ ...f, subject: e.target.value }))} />
            <Textarea placeholder="HTML content" value={emailForm.htmlContent} onChange={e => setEmailForm(f => ({ ...f, htmlContent: e.target.value }))} />
            <Button size="sm" onClick={() => createEmail.mutate()} disabled={!emailForm.brandId || !emailForm.name || createEmail.isPending}>
              <Plus size={12} className="mr-1" />Add Email Template
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">WhatsApp Templates (Meta)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(waTemplates ?? []).map((t: CommWhatsappTemplate) => (
            <div key={t.id} className="p-3 border rounded-lg">
              <p className="font-medium text-sm">{t.metaTemplateName}</p>
              <p className="text-xs text-muted-foreground">{t.category} · {t.bodyPreview.slice(0, 80)}</p>
            </div>
          ))}
          <div className="pt-3 border-t space-y-2">
            <Select value={waForm.brandId} onValueChange={v => setWaForm(f => ({ ...f, brandId: v }))}>
              <SelectTrigger><SelectValue placeholder="Brand" /></SelectTrigger>
              <SelectContent>{(brands ?? []).map((b: CommBrand) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Meta template name" value={waForm.metaTemplateName} onChange={e => setWaForm(f => ({ ...f, metaTemplateName: e.target.value }))} />
            <Input placeholder="Category" value={waForm.category} onChange={e => setWaForm(f => ({ ...f, category: e.target.value }))} />
            <Textarea placeholder="Body preview" value={waForm.bodyPreview} onChange={e => setWaForm(f => ({ ...f, bodyPreview: e.target.value }))} />
            <Button size="sm" onClick={() => createWa.mutate()} disabled={!waForm.brandId || !waForm.metaTemplateName || createWa.isPending}>
              <Plus size={12} className="mr-1" />Register WA Template
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
