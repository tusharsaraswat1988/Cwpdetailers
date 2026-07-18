import { useState } from "react";
import { Link } from "wouter";
import AdminLayout from "@/components/layout/AdminLayout";
import { DcmsAdminNav } from "../components/DcmsAdminNav";
import { useDcmsSubscriptions, useDcmsSubscriptionMutations, usePauseMutations } from "../api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Pause, Play, CalendarCheck } from "lucide-react";

export default function DcmsSubscriptionsPage() {
  const { data: subs, isLoading } = useDcmsSubscriptions();
  const { renew } = useDcmsSubscriptionMutations();
  const { pause, resume } = usePauseMutations();
  const { toast } = useToast();
  const [pauseOpen, setPauseOpen] = useState<number | null>(null);
  const [pauseForm, setPauseForm] = useState({ pauseStartDate: "", pauseEndDate: "", pauseReason: "" });

  const handleRenew = async (id: number) => {
    try {
      await renew.mutateAsync(id);
      toast({ title: "Subscription renewed" });
    } catch (e) {
      toast({ title: "Renewal blocked", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handlePause = async (id: number) => {
    try {
      await pause.mutateAsync({ id, ...pauseForm });
      setPauseOpen(null);
      setPauseForm({ pauseStartDate: "", pauseEndDate: "", pauseReason: "" });
      toast({ title: "Subscription paused" });
    } catch (e) {
      toast({ title: "Pause failed", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleResume = async (id: number) => {
    try {
      await resume.mutateAsync(id);
      toast({ title: "Subscription resumed" });
    } catch (e) {
      toast({ title: "Resume failed", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
        <DcmsAdminNav />
        <div className="flex justify-between items-center gap-3 flex-wrap">
          <div>
            <h2 className="font-display font-bold text-xl">Subscriptions</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              View and manage existing daily cleaning plans. New sales use Create Service Request.
            </p>
          </div>
          <Link href="/admin/book-services">
            <Button size="sm" variant="outline">
              <CalendarCheck className="h-4 w-4 mr-1" /> Create Service Request
            </Button>
          </Link>
        </div>

        {isLoading ? <p>Loading...</p> : (
          <div className="space-y-3">
            {subs?.map(row => {
              const s = row.subscription;
              const stats = (row as { visitStats?: { pendingCleanings: number; missedCleanings: number; completedCleanings: number; allocatedCleanings: number } }).visitStats;
              const renewalEligible = (row as { renewalEligible?: boolean }).renewalEligible;
              return (
                <Card key={s.id}>
                  <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{row.customerName} · {row.vehicleNumber}</p>
                      <p className="text-sm text-muted-foreground">{row.planName} · {row.vehicleMake} {row.vehicleModel}</p>
                      {stats && (
                        <div className="flex flex-wrap gap-3 mt-2 text-xs">
                          <span>Allocated: {stats.allocatedCleanings}</span>
                          <span>Completed: {stats.completedCleanings}</span>
                          <span className="text-amber-600">Pending: {stats.pendingCleanings}</span>
                          <span className="text-red-600">Missed: {stats.missedCleanings}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge>
                      {s.status === "active" && (
                        <Button size="sm" variant="outline" onClick={() => setPauseOpen(s.id)}>
                          <Pause className="h-3 w-3 mr-1" /> Pause
                        </Button>
                      )}
                      {s.status === "paused" && (
                        <Button size="sm" variant="outline" onClick={() => handleResume(s.id)}>
                          <Play className="h-3 w-3 mr-1" /> Resume
                        </Button>
                      )}
                      {renewalEligible ? (
                        <Button size="sm" variant="outline" onClick={() => handleRenew(s.id)}>
                          <RefreshCw className="h-3 w-3 mr-1" /> Renew
                        </Button>
                      ) : s.status === "active" && stats && stats.pendingCleanings > 0 && (
                        <span className="text-xs text-muted-foreground">Renewal blocked — pending visits remain</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Dialog open={pauseOpen != null} onOpenChange={v => !v && setPauseOpen(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Pause Subscription</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Start Date</Label><Input type="date" value={pauseForm.pauseStartDate} onChange={e => setPauseForm(f => ({ ...f, pauseStartDate: e.target.value }))} /></div>
              <div><Label>End Date</Label><Input type="date" value={pauseForm.pauseEndDate} onChange={e => setPauseForm(f => ({ ...f, pauseEndDate: e.target.value }))} /></div>
              <div><Label>Reason</Label><Input value={pauseForm.pauseReason} onChange={e => setPauseForm(f => ({ ...f, pauseReason: e.target.value }))} /></div>
              <Button onClick={() => pauseOpen && handlePause(pauseOpen)} disabled={pause.isPending} className="w-full">Confirm Pause</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
