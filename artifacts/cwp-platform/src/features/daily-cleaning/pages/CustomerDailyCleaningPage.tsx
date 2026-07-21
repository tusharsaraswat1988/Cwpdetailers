import { useState } from "react";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { useAccountScope } from "@/lib/account-scope";
import { useCustomerDcmsDashboard, usePendingFeedback, usePauseMutations } from "../api";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, History, Camera, ArrowRight, Pause } from "lucide-react";
import { CustomerVisitFeedback } from "../components/CustomerVisitFeedback";
import {
  CustomerPage,
  CustomerHeader,
  CustomerEmptyState,
  CustomerSkeleton,
  CustomerButton,
  CustomerCard,
  CustomerSubscriptionCard,
} from "@/features/customer-ds";

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
    <div data-testid="dcms-home-card">
    <CustomerSubscriptionCard>
      <div className="space-y-3">
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
          <CustomerButton href="/customer/daily-cleaning/history" variant="outline" size="sm" className="flex-1 text-xs">
            View History
          </CustomerButton>
          <CustomerButton href="/customer/daily-cleaning/gallery" variant="outline" size="sm" className="flex-1 text-xs">
            View Photos
          </CustomerButton>
          <CustomerButton href="/customer/daily-cleaning" size="sm" className="text-xs">
            Open <ArrowRight size={12} className="ml-1" />
          </CustomerButton>
        </div>
      </div>
    </CustomerSubscriptionCard>
    </div>
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
      <CustomerPage>
        <CustomerHeader title="Daily Cleaning" />

        {(pendingFeedback ?? []).length > 0 && (
          <CustomerVisitFeedback
            visitId={pendingFeedback![0]!.visit.id}
            onSubmitted={() => void refetchFeedback()}
          />
        )}

        {isLoading ? (
          <div className="space-y-3">
            <CustomerSkeleton className="h-28 w-full" />
            <CustomerSkeleton className="h-11 w-full" />
          </div>
        ) : !stats ? (
          <CustomerEmptyState
            title="No active daily cleaning subscription"
            description="Your daily cleaning plan will appear here once activated."
          />
        ) : (
          <>
            <CustomerSubscriptionCard>
              <div className="flex justify-between items-center mb-3">
                <h2 className="font-semibold text-base">Your Plan</h2>
                <Badge>{stats.status}</Badge>
              </div>
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
                <p className="text-xs text-muted-foreground text-center mt-3">
                  Paused {stats.pauseStartDate} — {stats.pauseEndDate}
                </p>
              )}
            </CustomerSubscriptionCard>

            <div className="flex gap-2">
              <CustomerButton href="/customer/daily-cleaning/history" variant="outline" className="flex-1">
                <History className="h-4 w-4 mr-1" /> Visit History
              </CustomerButton>
              <CustomerButton href="/customer/daily-cleaning/gallery" variant="outline" className="flex-1">
                <Camera className="h-4 w-4 mr-1" /> Photo Gallery
              </CustomerButton>
            </div>

            {stats.status === "active" && stats.subscriptionId && (
              <CustomerCard>
                <h2 className="font-semibold text-base flex items-center gap-1 mb-2">
                  <Pause size={14} /> Request Pause
                </h2>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Admin approval required. No visits or missed counts during pause.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">From</Label>
                      <Input type="date" value={pauseForm.pauseStartDate} onChange={e => setPauseForm(f => ({ ...f, pauseStartDate: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">To</Label>
                      <Input type="date" value={pauseForm.pauseEndDate} onChange={e => setPauseForm(f => ({ ...f, pauseEndDate: e.target.value }))} />
                    </div>
                  </div>
                  <Input placeholder="Reason (e.g. out of town)" value={pauseForm.pauseReason} onChange={e => setPauseForm(f => ({ ...f, pauseReason: e.target.value }))} />
                  <CustomerButton
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
                  </CustomerButton>
                </div>
              </CustomerCard>
            )}
          </>
        )}
      </CustomerPage>
    </CustomerLayout>
  );
}
