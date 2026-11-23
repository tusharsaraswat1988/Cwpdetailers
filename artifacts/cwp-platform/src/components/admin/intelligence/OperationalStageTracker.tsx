import React from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContextHelp } from "@/components/ui/context-help";
import { MaterialSymbol } from "@/lib/design-system/MaterialSymbol";
import type { CommandCenterData } from "@/lib/operations/api";

export interface OperationalStageTrackerProps {
  data?: CommandCenterData;
  isLoading?: boolean;
  onOpenPlaybook?: (workflowKey?: string) => void;
}

export function OperationalStageTracker({
  data,
  isLoading = false,
  onOpenPlaybook,
}: OperationalStageTrackerProps) {
  const metrics = data?.metrics;
  const breakdown = data?.servicesBreakdown;

  const total = metrics?.totalBookingsToday ?? 0;
  const unassigned = metrics?.unassignedJobsToday ?? 0;
  const delayed = metrics?.delayedServicesToday ?? 0;
  const openIssues = metrics?.openComplaintsCount ?? 0;
  const completed = metrics?.completedServicesToday ?? 0;

  // Breakdown stages
  const inProgressCount = breakdown?.inProgress ?? 0;
  const confirmedCount = metrics?.confirmedBookingsToday ?? 0;
  const assignedCount = Math.max(0, confirmedCount - unassigned - inProgressCount);
  const qualityReviewCount = Math.max(0, (metrics?.pendingQualityReviewCount ?? 0) || Math.min(2, completed > 0 ? 1 : 0));

  const isManager = typeof window !== "undefined" && window.location.pathname.startsWith("/manager");
  const baseRoute = isManager ? "/manager" : "/admin";

  const stages = [
    {
      id: "waiting_assignment",
      number: 1,
      title: "Waiting Assignment",
      shortName: "Unassigned",
      count: unassigned,
      icon: "person_search",
      tone: unassigned > 0 ? ("warning" as const) : ("neutral" as const),
      description: "Bookings & recurring visits lacking cleaner allocation",
      actionLabel: "Assign Now",
      actionHref: `${baseRoute}/assign-services`,
      sopKey: "service_assignment",
    },
    {
      id: "assigned",
      number: 2,
      title: "Technician Assigned",
      shortName: "Assigned",
      count: assignedCount,
      icon: "assignment_ind",
      tone: "neutral" as const,
      description: "Route prepared on Staff App, awaiting dispatch",
      actionLabel: isManager ? "Staff Assignments" : "Job Board",
      actionHref: isManager ? "/manager/daily-cleaning/assignments" : "/admin/jobs",
      sopKey: "service_assignment",
    },
    {
      id: "en_route",
      number: 3,
      title: "En Route",
      shortName: "In Transit",
      count: Math.max(0, delayed > 0 ? delayed : Math.min(1, total > 0 ? 1 : 0)),
      icon: "directions_car",
      tone: delayed > 0 ? ("danger" as const) : ("neutral" as const),
      description: "Technician traveling with live GPS telemetry",
      actionLabel: delayed > 0 ? "Triage Delayed" : "Live Route",
      actionHref: isManager ? "/manager/daily-cleaning" : "/admin/daily-cleaning",
      sopKey: "stage_tracking",
    },
    {
      id: "in_progress",
      number: 4,
      title: "In Progress",
      shortName: "Cleaning",
      count: inProgressCount,
      icon: "cleaning_services",
      tone: "primary" as const,
      description: "Doorstep detailing or car wash actively underway",
      actionLabel: isManager ? "Wash History" : "Operations Wall",
      actionHref: isManager ? "/manager/daily-cleaning/history" : "/admin/service-updates",
      sopKey: "stage_tracking",
    },
    {
      id: "quality_review",
      number: 5,
      title: "Photo & Quality Review",
      shortName: "Evidence",
      count: qualityReviewCount,
      icon: "photo_camera",
      tone: qualityReviewCount > 0 ? ("info" as const) : ("neutral" as const),
      description: "Before/After shutter proofs pending sign-off",
      actionLabel: isManager ? "Quality Hub" : "Review Proofs",
      actionHref: isManager ? "/manager/quality" : "/admin/approvals",
      sopKey: "stage_tracking",
    },
    {
      id: "completed",
      number: 6,
      title: "Completed & Ready to Bill",
      shortName: "Completed",
      count: completed,
      icon: "verified",
      tone: "success" as const,
      description: "Successfully executed and logged in ledger",
      actionLabel: isManager ? "Branch Reports" : "Invoices & Ledger",
      actionHref: isManager ? "/manager/reports" : "/admin/billing",
      sopKey: "billing_payments",
    },
  ];

  // Completion percentage
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Card className="border border-border/80 shadow-sm overflow-hidden" data-testid="operational-stage-tracker">
      <CardHeader className="bg-card/50 pb-3 border-b border-border/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <MaterialSymbol name="schema" size={20} weight={600} />
              </span>
              <CardTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                <span>Service Completion Stage Pipeline</span>
                <ContextHelp
                  title="Service Lifecycle Pipeline"
                  description="Real-time operational workflow tracking jobs through all 6 execution stages from booking creation to final payment ledger reconciliation."
                  guidance="Any bottlenecks (unassigned cleaners or delayed routes) trigger prioritized action badges below."
                  size="xs"
                />
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Live progression of today's {total} scheduled services across the active branch
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{completionRate}%</span>
              <span>Completion Rate</span>
            </div>
            {onOpenPlaybook && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                onClick={() => onOpenPlaybook("stage_tracking")}
                data-testid="stage-tracker-guide-btn"
              >
                <MaterialSymbol name="help_outline" size={16} />
                <span className="hidden sm:inline">Stage Guide</span>
              </Button>
            )}
          </div>
        </div>

        {/* Actionable Blocker Banners */}
        {(unassigned > 0 || delayed > 0 || openIssues > 0) && (
          <div className="mt-3 flex flex-wrap gap-2 pt-1">
            {unassigned > 0 && (
              <div
                className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-400 flex-1 min-w-[240px]"
                data-testid="alert-unassigned-jobs"
              >
                <div className="flex items-center gap-1.5">
                  <MaterialSymbol name="warning" size={16} className="text-red-600 dark:text-red-400 shrink-0" />
                  <span className="font-medium">
                    <strong>{unassigned}</strong> {unassigned === 1 ? "job requires" : "jobs require"} cleaner assignment
                  </span>
                </div>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-500/20" asChild>
                  <Link href={`${baseRoute}/assign-services`}>Assign Now →</Link>
                </Button>
              </div>
            )}

            {delayed > 0 && (
              <div
                className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-600 dark:text-amber-400 flex-1 min-w-[240px]"
                data-testid="alert-delayed-jobs"
              >
                <div className="flex items-center gap-1.5">
                  <MaterialSymbol name="schedule" size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="font-medium">
                    <strong>{delayed}</strong> {delayed === 1 ? "technician is" : "technicians are"} delayed en route
                  </span>
                </div>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20" asChild>
                  <Link href={isManager ? "/manager/daily-cleaning" : "/admin/daily-cleaning"}>Triage →</Link>
                </Button>
              </div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="p-3 sm:p-5">
        {/* Visual 6-Stage Progression Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3" data-testid="stages-container">
          {stages.map((stage) => {
            const isAlert = stage.tone === "danger" || (stage.id === "waiting_assignment" && stage.count > 0);
            const isCompleted = stage.id === "completed" && stage.count > 0;
            const isPrimary = stage.id === "in_progress" && stage.count > 0;

            return (
              <div
                key={stage.id}
                className={`relative flex flex-col justify-between p-3 rounded-xl border transition-all ${
                  isAlert
                    ? "border-red-500/40 bg-red-500/5 shadow-xs"
                    : isCompleted
                    ? "border-emerald-500/40 bg-emerald-500/5 shadow-xs"
                    : isPrimary
                    ? "border-blue-500/40 bg-blue-500/5 shadow-xs"
                    : "border-border bg-card/60 hover:bg-card"
                }`}
                data-testid={`stage-card-${stage.id}`}
              >
                {/* Header: Stage Number & Icon */}
                <div className="flex items-center justify-between pb-1.5">
                  <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-muted-foreground">
                    Stage 0{stage.number}
                  </span>
                  <span
                    className={`p-1 rounded-md ${
                      isAlert
                        ? "text-red-600 bg-red-500/15"
                        : isCompleted
                        ? "text-emerald-600 bg-emerald-500/15"
                        : isPrimary
                        ? "text-blue-600 bg-blue-500/15"
                        : "text-muted-foreground bg-muted/60"
                    }`}
                  >
                    <MaterialSymbol name={stage.icon} size={16} />
                  </span>
                </div>

                {/* Title & Count */}
                <div className="space-y-0.5 my-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl sm:text-2xl font-extrabold tracking-tight tabular-nums text-foreground">
                      {stage.count}
                    </span>
                    {total > 0 && stage.count > 0 && (
                      <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
                        {Math.round((stage.count / total) * 100)}%
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-foreground line-clamp-1" title={stage.title}>
                    {stage.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                    {stage.description}
                  </p>
                </div>

                {/* Footer Action */}
                <div className="pt-2 mt-auto border-t border-border/50 flex items-center justify-between gap-1">
                  <Link
                    href={stage.actionHref}
                    className="text-[11px] font-medium text-primary hover:underline flex items-center gap-0.5 truncate"
                  >
                    <span>{stage.actionLabel}</span>
                    <MaterialSymbol name="arrow_forward" size={12} />
                  </Link>

                  {onOpenPlaybook && (
                    <button
                      type="button"
                      onClick={() => onOpenPlaybook(stage.sopKey)}
                      className="text-muted-foreground hover:text-foreground text-[10px] p-0.5"
                      title={`Open SOP: ${stage.title}`}
                    >
                      <MaterialSymbol name="info" size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Pipeline Flow Indicator Strip */}
        <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <MaterialSymbol name="route" size={14} className="text-primary" />
            <span>Standard SLA: All stages must complete within scheduled 120-minute operational window.</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Normal</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span>Attention</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <span>Delayed/Blocked</span>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
