import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { commApi } from "../api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function CommunicationPreferences({ customerId }: { customerId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: consent, isLoading } = useQuery({
    queryKey: ["comm-consent", customerId],
    queryFn: () => commApi.getConsent(customerId),
    enabled: customerId > 0,
  });

  const updateMut = useMutation({
    mutationFn: (patch: Partial<{ smsConsent: boolean; whatsappConsent: boolean; emailConsent: boolean; pushConsent: boolean }>) =>
      commApi.updateConsent(customerId, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comm-consent", customerId] });
      toast({ title: "Communication preferences updated" });
    },
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <Skeleton className="h-32 w-full rounded-xl" />;

  const toggles = [
    { key: "smsConsent" as const, label: "SMS Enabled" },
    { key: "whatsappConsent" as const, label: "WhatsApp Enabled" },
    { key: "emailConsent" as const, label: "Email Enabled" },
    { key: "pushConsent" as const, label: "Push Enabled" },
  ];

  return (
    <div className="space-y-3">
      {toggles.map(({ key, label }) => (
        <div key={key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
          <Label htmlFor={key} className="text-sm">{label}</Label>
          <Switch
            id={key}
            checked={Boolean(consent?.[key])}
            disabled={updateMut.isPending}
            onCheckedChange={(checked) => updateMut.mutate({ [key]: checked })}
          />
        </div>
      ))}
      <div className="flex flex-wrap gap-2 pt-2 text-xs text-muted-foreground">
        {consent?.consentSource && (
          <Badge variant="outline">Source: {consent.consentSource.replace(/_/g, " ")}</Badge>
        )}
        {consent?.consentDate && (
          <span>Updated {new Date(consent.consentDate).toLocaleDateString("en-IN")}</span>
        )}
      </div>
    </div>
  );
}
