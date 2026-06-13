import { useQuery } from "@tanstack/react-query";
import { commApi } from "../api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  campaignId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function CampaignDetailDialog({ campaignId, open, onOpenChange }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["comm-campaign-detail", campaignId],
    queryFn: () => commApi.getCampaignDetail(campaignId!),
    enabled: open && campaignId != null,
  });

  const stats = data?.stats ?? {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{data?.name ?? "Campaign Detail"}</DialogTitle>
        </DialogHeader>
        {isLoading ? <Skeleton className="h-40" /> : data && (
          <div className="space-y-4 mt-2">
            <div className="flex gap-2">
              <Badge>{data.channel}</Badge>
              <Badge variant="outline">{data.status}</Badge>
              {data.roi != null && <Badge variant="secondary">ROI: {data.roi}x</Badge>}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Sent", value: stats.sent ?? 0 },
                { label: "Delivered", value: stats.delivered ?? 0 },
                { label: "Failed", value: stats.failed ?? 0 },
                { label: "Consent Blocked", value: stats.consentBlocked ?? 0 },
                { label: "Bookings", value: stats.bookingsGenerated ?? 0 },
                { label: "Invoices", value: stats.invoicesGenerated ?? 0 },
              ].map(s => (
                <Card key={s.label}>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="font-bold text-lg">{s.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="p-3 rounded-lg bg-primary/5 border">
              <p className="text-sm text-muted-foreground">Revenue Generated</p>
              <p className="font-display font-bold text-xl text-primary">
                ₹{(data.attribution?.summary.revenue ?? stats.revenue ?? 0).toLocaleString("en-IN")}
              </p>
            </div>

            <div>
              <p className="text-sm font-semibold mb-2">Attributed Customers ({data.attribution?.summary.customers ?? 0})</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {(data.attribution?.attributions ?? []).slice(0, 20).map(a => (
                  <div key={a.id} className="text-xs flex justify-between p-2 rounded border">
                    <span>Customer #{a.customerId}</span>
                    <span className="font-medium">₹{Number(a.revenueAmount).toLocaleString("en-IN")}</span>
                  </div>
                ))}
                {!data.attribution?.attributions?.length && (
                  <p className="text-xs text-muted-foreground text-center py-4">No attributions yet (30-day window)</p>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
