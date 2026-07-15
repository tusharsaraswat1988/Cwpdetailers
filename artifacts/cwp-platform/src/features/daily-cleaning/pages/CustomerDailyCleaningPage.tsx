import { useState } from "react";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { useAccountScope } from "@/lib/account-scope";
import { useCustomerDcmsDashboard, usePendingFeedback, usePauseMutations } from "../api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, History, Camera, ArrowRight, Pause } from "lucide-react";
import { CustomerVisitFeedback } from "../components/CustomerVisitFeedback";
import { Skeleton } from "@/components/ui/skeleton";

type DcmsStats = {
  subscriptionId?: number;
  allocatedCleanings?: number;
  usedCleanings?: number;
  remainingCleanings?: number;
  allocatedWashes?: number;
  usedWashes?: number;
  remainingWashes?: number;
  status?: string;
};

/** Compact card for customer home dashboard. */
export function DcmsHomeCard() {
  const { customerId } = useAccountScope();
  const { data, isLoading } = useCustomerDcmsDashboard(customerId != null);
  const stats = data?.stats as DcmsStats | null;

  if (isLoading) return null;
  if (!stats?.subscriptionId) return null;

  const cleaningsDone = stats.usedCleanings ?? 0;
  const cleaningsTotal = stats.allocatedCleanings ?? 0;
  const washesDone = stats.usedWashes ?? 0;
  const washesTotal = stats.allocatedWashes ?? 0;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-card" data-testid="dcms-home-card">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary flex items-center gap-1">
            <Sparkles size={14} /> My Daily Cleaning Plan
          </p>
          <Badge variant={stats.status === "paused" ? "secondary" : "default"}>{stats.status}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Cleanings</p>
            <p className="font-bold text-lg">{cleaningsTotal - (stats.remainingCleanings ?? 0)} / {cleaningsTotal}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Washes</p>
            <p className="font-bold text-lg">{washesDone} / {washesTotal}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/customer/daily-cleaning/history" className="flex-1">
            <Button variant="outline" size="sm" className="w-full text-xs">View History</Button>
          </Link>
          <Link href="/customer/daily-cleaning/gallery" className="flex-1">
            <Button variant="outline" size="sm" className="w-full text-xs">View Photos</Button>
          </Link>
          <Link href="/customer/daily-cleaning">
            <Button size="sm" className="text-xs">Open <ArrowRight size={12} className="ml-1" /></Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CustomerDailyCleaningPage() {
  const { data, isLoading } = useCustomerDcmsDashboard();
  const { data: pendingFeedback, refetch: refetchFeedback } = usePendingFeedback();
  const { requestPause } = usePauseMutations();
  const { toast } = useToast();
  const [pauseForm, setPauseForm] = useState({ pauseStartDate: "", pauseEndDate: "", pauseReason: "" });
  const stats = data?.stats as DcmsStats & {
    missedCleanings?: number; renewalEligible?: boolean; renewalBlocked?: boolean;
    pauseStartDate?: string; pauseEndDate?: string;
  } | null;

  return (
    <CustomerLayout>
      <div className="space-y-4">
        <h1 className="font-display font-bold text-xl">Daily Cleaning</h1>

        {(pendingFeedback ?? []).length > 0 && (
          <CustomerVisitFeedback
            visitId={pendingFeedback![0]!.visit.id}
            onSubmitted={() => void refetchFeedback()}
          />
        )}

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        ) : !stats ? (
          <Card><CardContent className="p-6 text-center text-muted-foreground">No active daily cleaning subscription</CardContent></Card>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base">Your Plan</CardTitle>
                  <Badge>{stats.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-2xl font-bold">{stats.usedCleanings} / {stats.allocatedCleanings}</p>
                    <p className="text-xs text-muted-foreground">Cleanings</p>
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-2xl font-bold">{stats.usedWashes} / {stats.allocatedWashes}</p>
                    <p className="text-xs text-muted-foreground">Washes</p>
                  </div>
                </div>
                {stats.status === "paused" && stats.pauseStartDate && (
                  <p className="text-xs text-muted-foreground text-center">
                    Paused {stats.pauseStartDate} — {stats.pauseEndDate}
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Link href="/customer/daily-cleaning/history" className="flex-1">
                <Button variant="outline" className="w-full"><History className="h-4 w-4 mr-1" /> Visit History</Button>
              </Link>
              <Link href="/customer/daily-cleaning/gallery" className="flex-1">
                <Button variant="outline" className="w-full"><Camera className="h-4 w-4 mr-1" /> Photo Gallery</Button>
              </Link>
            </div>

            {stats.status === "active" && stats.subscriptionId && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-1"><Pause size={14} /> Request Pause</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-muted-foreground">Admin approval required. No visits or missed counts during pause.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">From</Label><Input type="date" value={pauseForm.pauseStartDate} onChange={e => setPauseForm(f => ({ ...f, pauseStartDate: e.target.value }))} /></div>
                    <div><Label className="text-xs">To</Label><Input type="date" value={pauseForm.pauseEndDate} onChange={e => setPauseForm(f => ({ ...f, pauseEndDate: e.target.value }))} /></div>
                  </div>
                  <Input placeholder="Reason (e.g. out of town)" value={pauseForm.pauseReason} onChange={e => setPauseForm(f => ({ ...f, pauseReason: e.target.value }))} />
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={requestPause.isPending || !pauseForm.pauseStartDate || !pauseForm.pauseEndDate}
                    onClick={async () => {
                      try {
                        await requestPause.mutateAsync({ subscriptionId: stats.subscriptionId!, ...pauseForm });
                        toast({ title: "Pause request submitted for admin approval" });
                        setPauseForm({ pauseStartDate: "", pauseEndDate: "", pauseReason: "" });
                      } catch (e) {
                        toast({ title: "Request failed", description: (e as Error).message, variant: "destructive" });
                      }
                    }}
                  >
                    Submit Pause Request
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </CustomerLayout>
  );
}
