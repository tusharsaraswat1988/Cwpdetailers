import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, CreditCard, RefreshCw, Save, Info } from "lucide-react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface OauthSettings {
  dataCollected: string;
  dataUsageDescription: string;
  dataRetentionDescription: string;
  dataDeletionProcess: string;
  privacyPolicyUrl: string;
  termsUrl: string;
  updatedAt: string;
}

interface RefundSettings {
  refundEligibleCases: string[];
  nonRefundableCases: string[];
  refundProcessingDays: string;
  cancellationRules: string;
  advancePaymentRules?: string | null;
  partialPaymentRules?: string | null;
  fullPaymentRules?: string | null;
  settlementInfo?: string | null;
  acceptedPaymentMethods: string[];
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

type TabType = "oauth" | "refund";

function SectionCard({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
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

// ─── Google OAuth Panel ───────────────────────────────────────────────────────

function OAuthPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: settings } = useQuery<OauthSettings>({
    queryKey: ["oauth-compliance"],
    queryFn: () => apiGet("/api/oauth-compliance"),
    staleTime: 60_000,
  });

  const [form, setForm] = useState({
    dataCollected: "Name, Email address, Profile photo",
    dataUsageDescription: "",
    dataRetentionDescription: "",
    dataDeletionProcess: "",
    privacyPolicyUrl: "/privacy-policy",
    termsUrl: "/terms-and-conditions",
  });

  useEffect(() => {
    if (settings) {
      setForm({
        dataCollected: settings.dataCollected ?? "",
        dataUsageDescription: settings.dataUsageDescription ?? "",
        dataRetentionDescription: settings.dataRetentionDescription ?? "",
        dataDeletionProcess: settings.dataDeletionProcess ?? "",
        privacyPolicyUrl: settings.privacyPolicyUrl ?? "/privacy-policy",
        termsUrl: settings.termsUrl ?? "/terms-and-conditions",
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () => apiPut("/api/admin/oauth-compliance", form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["oauth-compliance"] });
      toast({ title: "Saved", description: "Google OAuth compliance settings updated." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const f = (k: keyof typeof form) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value })),
  });

  return (
    <div className="space-y-5">
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex gap-2 text-sm">
        <Info size={14} className="text-primary mt-0.5 flex-shrink-0" />
        <p className="text-muted-foreground text-xs">
          These settings populate the <strong className="text-foreground">Privacy Policy</strong> and{" "}
          <strong className="text-foreground">Data Deletion</strong> pages dynamically. Required for Google OAuth consent verification.
        </p>
      </div>

      <SectionCard icon={ShieldCheck} title="Data Collection">
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-1">Data Collected from Google Sign-In</Label>
            <Input {...f("dataCollected")} placeholder="Name, Email address, Profile photo" />
            <p className="text-xs text-muted-foreground mt-1">Comma-separated list of data fields collected via Google OAuth.</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1">How We Use This Data</Label>
            <Textarea {...f("dataUsageDescription")} rows={3} placeholder="We use your name, email and profile image to create and manage your account..." />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1">Data Retention Policy</Label>
            <Textarea {...f("dataRetentionDescription")} rows={3} placeholder="We retain your personal data for as long as your account is active..." />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1">Data Deletion Process</Label>
            <Textarea {...f("dataDeletionProcess")} rows={3} placeholder="Users can request data deletion by emailing cwpdetailers@gmail.com..." />
          </div>
        </div>
      </SectionCard>

      <SectionCard icon={ShieldCheck} title="Policy URLs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-1">Privacy Policy URL</Label>
            <Input {...f("privacyPolicyUrl")} placeholder="/privacy-policy" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1">Terms & Conditions URL</Label>
            <Input {...f("termsUrl")} placeholder="/terms-and-conditions" />
          </div>
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2">
          <Save size={15} />
          {saveMutation.isPending ? "Saving..." : "Save Google OAuth Settings"}
        </Button>
      </div>
      {settings?.updatedAt && (
        <p className="text-xs text-muted-foreground text-right">
          Last updated: {new Date(settings.updatedAt).toLocaleString("en-IN")}
        </p>
      )}
    </div>
  );
}

// ─── Refund & Payments Panel ──────────────────────────────────────────────────

function RefundPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: settings } = useQuery<RefundSettings>({
    queryKey: ["refund-settings"],
    queryFn: () => apiGet("/api/refund-settings"),
    staleTime: 60_000,
  });

  const [form, setForm] = useState({
    refundEligibleRaw: "",
    nonRefundableRaw: "",
    refundProcessingDays: "7-10 business days",
    cancellationRules: "",
    advancePaymentRules: "",
    partialPaymentRules: "",
    fullPaymentRules: "",
    settlementInfo: "",
    paymentMethodsRaw: "",
  });

  useEffect(() => {
    if (settings) {
      setForm({
        refundEligibleRaw: (settings.refundEligibleCases ?? []).join("\n"),
        nonRefundableRaw: (settings.nonRefundableCases ?? []).join("\n"),
        refundProcessingDays: settings.refundProcessingDays ?? "7-10 business days",
        cancellationRules: settings.cancellationRules ?? "",
        advancePaymentRules: settings.advancePaymentRules ?? "",
        partialPaymentRules: settings.partialPaymentRules ?? "",
        fullPaymentRules: settings.fullPaymentRules ?? "",
        settlementInfo: settings.settlementInfo ?? "",
        paymentMethodsRaw: (settings.acceptedPaymentMethods ?? []).join("\n"),
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiPut("/api/admin/refund-settings", {
        refundEligibleCases: form.refundEligibleRaw.split("\n").map(s => s.trim()).filter(Boolean),
        nonRefundableCases: form.nonRefundableRaw.split("\n").map(s => s.trim()).filter(Boolean),
        refundProcessingDays: form.refundProcessingDays,
        cancellationRules: form.cancellationRules,
        advancePaymentRules: form.advancePaymentRules || null,
        partialPaymentRules: form.partialPaymentRules || null,
        fullPaymentRules: form.fullPaymentRules || null,
        settlementInfo: form.settlementInfo || null,
        acceptedPaymentMethods: form.paymentMethodsRaw.split("\n").map(s => s.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["refund-settings"] });
      toast({ title: "Saved", description: "Refund & payment settings updated." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const f = (k: keyof typeof form) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value })),
  });

  return (
    <div className="space-y-5">
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex gap-2">
        <Info size={14} className="text-primary mt-0.5 flex-shrink-0" />
        <p className="text-muted-foreground text-xs">
          These settings drive the <strong className="text-foreground">Refund Policy</strong> page,{" "}
          <strong className="text-foreground">checkout screen</strong>, and{" "}
          <strong className="text-foreground">booking confirmation</strong> dynamically.
        </p>
      </div>

      <SectionCard icon={RefreshCw} title="Refund Rules">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-1">Refund Eligible Cases (one per line)</Label>
            <Textarea {...f("refundEligibleRaw")} rows={6} className="font-mono text-sm" placeholder="Service failure on company side&#10;Duplicate payment" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1">Non-Refundable Cases (one per line)</Label>
            <Textarea {...f("nonRefundableRaw")} rows={6} className="font-mono text-sm" placeholder="Customer-initiated cancellation&#10;Service already rendered" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1">Refund Processing Time</Label>
            <Input {...f("refundProcessingDays")} placeholder="7-10 business days" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1">Accepted Payment Methods (one per line)</Label>
            <Textarea {...f("paymentMethodsRaw")} rows={4} className="font-mono text-sm" placeholder="UPI&#10;Credit Card&#10;Debit Card&#10;Net Banking" />
          </div>
        </div>
        <div className="mt-4">
          <Label className="text-xs text-muted-foreground mb-1">Cancellation Rules (full text)</Label>
          <Textarea {...f("cancellationRules")} rows={3} placeholder="Describe the overall cancellation policy..." />
        </div>
      </SectionCard>

      <SectionCard icon={CreditCard} title="Payment Rules (Razorpay Compliance)">
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-1">Advance Payment Rules</Label>
            <Textarea {...f("advancePaymentRules")} rows={2} placeholder="e.g. 50% advance required for certain services..." />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1">Partial Payment Rules</Label>
            <Textarea {...f("partialPaymentRules")} rows={2} placeholder="e.g. Partial payments are accepted for packages..." />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1">Full Payment Rules</Label>
            <Textarea {...f("fullPaymentRules")} rows={2} placeholder="e.g. Full payment required for PPF and ceramic coating..." />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1">Settlement Information</Label>
            <Textarea {...f("settlementInfo")} rows={2} placeholder="e.g. Payments settle to business account within 2 business days..." />
          </div>
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2">
          <Save size={15} />
          {saveMutation.isPending ? "Saving..." : "Save Refund & Payment Settings"}
        </Button>
      </div>
      {settings?.updatedAt && (
        <p className="text-xs text-muted-foreground text-right">
          Last updated: {new Date(settings.updatedAt).toLocaleString("en-IN")}
        </p>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS: { id: TabType; label: string; icon: React.ElementType }[] = [
  { id: "oauth", label: "Google OAuth", icon: ShieldCheck },
  { id: "refund", label: "Refund & Payments", icon: CreditCard },
];

export default function ComplianceSettings() {
  const [tab, setTab] = useState<TabType>("oauth");

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="font-display font-bold text-2xl text-foreground">Compliance Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage Google OAuth data policy and Razorpay payment compliance settings.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>

        {tab === "oauth" && <OAuthPanel />}
        {tab === "refund" && <RefundPanel />}
      </div>
    </AdminLayout>
  );
}
