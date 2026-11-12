import { useQuery } from "@tanstack/react-query";
import { IndianRupee, Clock, Droplets, Car, ShieldAlert } from "lucide-react";
import {
  StaffPage,
  StaffHeader,
  StaffSkeleton,
  StaffEmptyState,
  StaffCard,
  StaffCardHeader,
  StaffCardTitle,
  StaffCardContent,
} from "@/features/staff-ds";
import { Badge } from "@/components/ui/badge";

type StaffPayoutRecord = {
  id: number;
  periodMonth: string;
  employmentType: string;
  baseSalary: string;
  perWashRate: string;
  perDailyCleaningRate: string;
  completedWashes: number;
  completedDailyCleans: number;
  washEarnings: string;
  dailyCleaningEarnings: string;
  grossPayout: string;
  deductions: string;
  incentives: string;
  netPayoutDue: string;
  status: "draft" | "approved" | "disbursed" | "cancelled";
  paymentMethod?: string | null;
  transactionReference?: string | null;
  disbursedAt?: string | null;
  notes?: string | null;
};

type EarningsResponse = {
  staffId: number;
  currentMonth: string;
  currentPeriod: StaffPayoutRecord | null;
  history: StaffPayoutRecord[];
};

export default function StaffEarnings() {
  const { data, isLoading, error } = useQuery<EarningsResponse>({
    queryKey: ["staff", "me", "earnings"],
    queryFn: async () => {
      const res = await fetch("/api/staff/me/earnings", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load earnings");
      return res.json();
    },
  });

  const current = data?.currentPeriod;
  const history = (data?.history ?? []).filter(h => h.periodMonth !== data?.currentMonth);

  return (
    <StaffPage className="space-y-4 pb-20">
      <StaffHeader title="Earnings & Payouts" subtitle="Track your compensation, verified cleanings & monthly payouts" />

      {isLoading ? (
        <div className="space-y-3">
          <StaffSkeleton className="h-32 w-full" />
          <StaffSkeleton className="h-24 w-full" />
        </div>
      ) : error ? (
        <StaffEmptyState
          icon={<ShieldAlert size={20} className="text-destructive" />}
          title="Could not load earnings"
          description="Failed to load payout details. Please contact your supervisor."
        />
      ) : (
        <>
          {/* Current Period Spotlight Card */}
          {current ? (
            <StaffCard className="border-primary/20 bg-primary/[0.02]">
              <StaffCardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Current Month ({current.periodMonth})
                    </span>
                    <StaffCardTitle className="text-lg flex items-center gap-1.5 text-primary mt-0.5">
                      <IndianRupee size={18} />
                      {Number(current.netPayoutDue).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </StaffCardTitle>
                  </div>
                  <Badge
                    variant={
                      current.status === "disbursed"
                        ? "default"
                        : current.status === "approved"
                          ? "secondary"
                          : "outline"
                    }
                    className="capitalize"
                  >
                    {current.status}
                  </Badge>
                </div>
              </StaffCardHeader>
              <StaffCardContent className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-background p-2.5 border">
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Car size={11} className="text-primary" /> Daily Cleans
                    </p>
                    <p className="text-sm font-bold mt-0.5">{current.completedDailyCleans}</p>
                    <p className="text-[10px] text-muted-foreground">
                      ₹{Number(current.dailyCleaningEarnings).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className="rounded-lg bg-background p-2.5 border">
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Droplets size={11} className="text-primary" /> Washes
                    </p>
                    <p className="text-sm font-bold mt-0.5">{current.completedWashes}</p>
                    <p className="text-[10px] text-muted-foreground">
                      ₹{Number(current.washEarnings).toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground space-y-1 pt-1 border-t">
                  {Number(current.baseSalary) > 0 && (
                    <div className="flex justify-between">
                      <span>Base Salary:</span>
                      <span className="font-semibold text-foreground">₹{Number(current.baseSalary).toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  {Number(current.incentives) > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Performance Bonus / Incentives:</span>
                      <span className="font-semibold">+₹{Number(current.incentives).toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  {Number(current.deductions) > 0 && (
                    <div className="flex justify-between text-destructive">
                      <span>Deductions:</span>
                      <span className="font-semibold">-₹{Number(current.deductions).toLocaleString("en-IN")}</span>
                    </div>
                  )}
                </div>
              </StaffCardContent>
            </StaffCard>
          ) : null}

          {/* Past Payouts History */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              Payout History
            </h3>
            {history.length === 0 ? (
              <StaffEmptyState
                icon={<Clock size={20} className="text-muted-foreground" />}
                title="No past payout records"
                description="Past approved and disbursed monthly earnings statements will appear here."
              />
            ) : (
              <div className="space-y-2">
                {history.map(item => (
                  <StaffCard key={item.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold">{item.periodMonth}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {item.completedDailyCleans} cleans • {item.completedWashes} washes
                        </p>
                        {item.transactionReference ? (
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                            Ref: {item.transactionReference}
                          </p>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground">
                          ₹{Number(item.netPayoutDue).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </p>
                        <Badge
                          variant={item.status === "disbursed" ? "default" : "secondary"}
                          className="text-[9px] capitalize mt-1"
                        >
                          {item.status}
                        </Badge>
                      </div>
                    </div>
                  </StaffCard>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </StaffPage>
  );
}
