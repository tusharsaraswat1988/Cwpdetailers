import { useState } from "react";
import { Link } from "wouter";
import AdminLayout from "@/components/layout/AdminLayout";
import { DcmsAdminNav } from "../components/DcmsAdminNav";
import { useDcmsSubscriptions, useDcmsSubscriptionMutations, usePauseMutations } from "../api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Pause, Play, CalendarCheck, XCircle, AlertTriangle, Search } from "lucide-react";

export default function DcmsSubscriptionsPage() {
  const { data: subs, isLoading } = useDcmsSubscriptions();
  const { renew, cancel } = useDcmsSubscriptionMutations();
  const { pause, resume } = usePauseMutations();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [pauseOpen, setPauseOpen] = useState<number | null>(null);
  const [pauseForm, setPauseForm] = useState({ pauseStartDate: "", pauseEndDate: "", pauseReason: "" });
  const [cancelOpen, setCancelOpen] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const handleRenew = async (id: number) => {
    try {
      await renew.mutateAsync(id);
      toast({ title: "Subscription renewed successfully" });
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

  const handleCancel = async () => {
    if (!cancelOpen) return;
    try {
      await cancel.mutateAsync({ id: cancelOpen, reason: cancelReason.trim() || undefined });
      setCancelOpen(null);
      setCancelReason("");
      toast({ title: "Subscription cancelled", description: "Cleaner assignments deactivated" });
    } catch (e) {
      toast({ title: "Cancellation failed", description: (e as Error).message, variant: "destructive" });
    }
  };

  const filteredSubs = subs?.filter(row => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      row.customerName?.toLowerCase().includes(term) ||
      row.vehicleNumber?.toLowerCase().includes(term) ||
      row.planName?.toLowerCase().includes(term) ||
      row.subscription.status?.toLowerCase().includes(term)
    );
  });

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
        <DcmsAdminNav />
        <div className="flex justify-between items-center gap-3 flex-wrap">
          <div>
            <h2 className="font-display font-bold text-xl">Subscriptions Lifecycle</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Unified lifecycle: renewal eligibility, remaining cleanings, pause/resume, and cancellation.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search vehicle or customer..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 h-9 w-60 text-xs"
              />
            </div>
            <Link href="/admin/book-services">
              <Button size="sm" variant="outline">
                <CalendarCheck className="h-4 w-4 mr-1" /> Create Service Request
              </Button>
            </Link>
          </div>
        </div>

        {isLoading ? <p>Loading subscriptions...</p> : (
          <div className="space-y-3">
            {filteredSubs?.map(row => {
              const s = row.subscription;
              const stats = (row as { visitStats?: { pendingCleanings: number; missedCleanings: number; completedCleanings: number; allocatedCleanings: number } }).visitStats;
              const renewalEligible = (row as { renewalEligible?: boolean }).renewalEligible;
              const isLowCleanings = s.status === "active" && s.remainingCleanings <= 3;

              return (
                <Card key={s.id} className={isLowCleanings ? "border-amber-500/40" : ""}>
                  <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{row.customerName} · {row.vehicleNumber}</p>
                        {isLowCleanings && (
                          <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {s.remainingCleanings} cleanings left
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{row.planName} · {row.vehicleMake} {row.vehicleModel}</p>
                      <div className="flex flex-wrap gap-3 mt-2 text-xs">
                        <span>Allocated: {s.allocatedCleanings}</span>
                        <span className="text-emerald-600 font-medium">Used: {s.usedCleanings}</span>
                        <span className="font-semibold text-foreground">Remaining: {s.remainingCleanings}</span>
                        {s.remainingWashes > 0 && <span className="text-blue-600">Washes left: {s.remainingWashes}</span>}
                        {stats && stats.missedCleanings > 0 && (
                          <span className="text-red-600">Missed: {stats.missedCleanings}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={s.status === "active" ? "default" : s.status === "cancelled" ? "destructive" : "secondary"}>
                        {s.status}
                      </Badge>
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
                        <span className="text-xs text-muted-foreground">Renewal blocked — cleanings remain</span>
                      )}
                      {s.status !== "cancelled" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          onClick={() => {
                            setCancelOpen(s.id);
                            setCancelReason("");
                          }}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Cancel
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Pause Modal */}
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

        {/* Cancel Modal */}
        <Dialog open={cancelOpen != null} onOpenChange={v => !v && setCancelOpen(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-rose-600 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Cancel Subscription
              </DialogTitle>
              <DialogDescription>
                This will immediately cancel the active subscription and deactivate all assigned cleaner routes for this vehicle.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <Label htmlFor="cancelReasonInput">Cancellation Reason (Optional)</Label>
              <Input
                id="cancelReasonInput"
                placeholder="e.g. Customer relocated, vehicle sold..."
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setCancelOpen(null)}>
                Keep Active
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleCancel}
                disabled={cancel.isPending}
              >
                {cancel.isPending ? "Cancelling..." : "Confirm Cancellation"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
