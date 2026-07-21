import { useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useStaffJobsData } from "@/hooks/useStaffJobsData";
import { suppressStaffJobAlert } from "@/hooks/useStaffJobAlerts";
import { StaffAccountGate } from "@/components/staff/StaffAccountGate";
import { StaffJobListItem } from "@/components/staff/StaffJobListItem";
import { StaffServiceJobFlow } from "@/components/staff/StaffServiceJobFlow";
import { StaffWalkInPanel } from "@/components/staff/StaffWalkInPanel";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar, ChevronDown, ChevronLeft, UserPlus } from "lucide-react";
import { staffJobKey, type StaffJob } from "@/lib/staff-jobs";
import { cn } from "@/lib/utils";
import {
  StaffSkeleton,
  StaffEmptyState,
  StaffErrorState,
  StaffStatusBadge,
  StaffCard,
  StaffSuccessBanner,
} from "@/features/staff-ds";

type Props = {
  selectedJobKey?: string | null;
  onSelectJob: (key: string | null) => void;
};

const WALK_IN_SUCCESS_MSG = "Customer ready — agla customer khojo";

export function StaffOtherServicesPanel({ selectedJobKey, onSelectJob }: Props) {
  const jobs = useStaffJobsData();
  const [, navigate] = useLocation();
  const search = useSearch();
  const [selectedJob, setSelectedJob] = useState<StaffJob | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [fromWalkIn, setFromWalkIn] = useState(false);
  const [walkInSuccess, setWalkInSuccess] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("walkInSuccess") === "1") {
      setWalkInOpen(true);
      setWalkInSuccess(WALK_IN_SUCCESS_MSG);
      params.delete("walkInSuccess");
      const qs = params.toString();
      const path = qs ? `/staff/bookings?${qs}` : "/staff/bookings";
      window.history.replaceState(null, "", path);
    }
  }, [search]);

  useEffect(() => {
    if (!selectedJobKey || jobs.loadingToday) return;
    const match = jobs.today.find(j => staffJobKey(j) === selectedJobKey);
    if (!match) return;

    let cancelled = false;
    setLoadingDetail(true);
    void jobs.loadJobWithPhotos(match).then(enriched => {
      if (cancelled) return;
      setSelectedJob(enriched);
      setLoadingDetail(false);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedJobKey, jobs.loadingToday, jobs.today]);

  async function refreshSelectedJob(job: StaffJob) {
    const refreshed = await jobs.refetchToday();
    const match = refreshed.find(j => staffJobKey(j) === staffJobKey(job));
    if (!match) return;
    const enriched = await jobs.loadJobWithPhotos(match);
    setSelectedJob(enriched);
  }

  async function handleTransitionJob(jobId: number, toStatus: string, job?: StaffJob) {
    await jobs.transitionJob(jobId, toStatus, job);
    if (job) await refreshSelectedJob(job);
    if (fromWalkIn && toStatus === "completed") {
      setSelectedJob(null);
      onSelectJob(null);
      setFromWalkIn(false);
      setWalkInOpen(true);
      setWalkInSuccess(WALK_IN_SUCCESS_MSG);
      navigate("/staff/bookings?walkInSuccess=1");
    }
  }

  if (jobs.scopeLoading || jobs.missingStaffLink || jobs.staffId == null) {
    return (
      <StaffAccountGate
        scopeLoading={jobs.scopeLoading}
        missingStaffLink={jobs.missingStaffLink}
        staffId={jobs.staffId}
      >
        {null}
      </StaffAccountGate>
    );
  }

  const mutations = {
    transitionJob: handleTransitionJob,
    uploadGeoPhoto: async (
      job: StaffJob,
      kind: "before" | "after",
      file: File,
      photoIndex: number,
    ) => {
      await jobs.uploadGeoPhoto(job, kind, file, photoIndex);
      await refreshSelectedJob(job);
    },
    completeJobWithNotes: async (job: StaffJob, notes: string) => {
      await jobs.completeJobWithNotes(job, notes);
      await refreshSelectedJob(job);
    },
    uploadingJobId: jobs.uploadingJobId,
    uploadingPhotoIndex: jobs.uploadingPhotoIndex,
    locatingJobId: jobs.locatingJobId,
    isActionPending: jobs.isActionPending,
  };

  if (selectedJob) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => {
            setSelectedJob(null);
            onSelectJob(null);
            setFromWalkIn(false);
          }}
          className="staff-tap inline-flex items-center gap-1 text-sm font-semibold text-primary"
        >
          <ChevronLeft size={16} aria-hidden /> Back to jobs
        </button>
        <StaffCard padded={false} className="overflow-hidden">
          <div className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate font-display text-lg font-bold">{selectedJob.customerName}</h2>
                <p className="text-sm capitalize text-muted-foreground">
                  {(selectedJob.serviceName ?? selectedJob.serviceType)?.replace(/_/g, " ")}
                  {selectedJob.scheduledTime ? ` · ${selectedJob.scheduledTime}` : ""}
                </p>
              </div>
              <StaffStatusBadge status={selectedJob.status ?? "scheduled"} className="shrink-0" />
            </div>
            {loadingDetail ? (
              <StaffSkeleton className="h-48 w-full" />
            ) : (
              <StaffServiceJobFlow job={selectedJob} {...mutations} />
            )}
          </div>
        </StaffCard>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {walkInSuccess ? (
        <StaffSuccessBanner title="Walk-in ready" description={walkInSuccess} />
      ) : null}
      <Collapsible open={walkInOpen} onOpenChange={setWalkInOpen}>
        <CollapsibleTrigger className="staff-action-card staff-tap flex w-full items-center justify-between px-4 py-3 text-sm font-medium">
          <span className="flex items-center gap-2">
            <UserPlus size={16} className="text-primary" aria-hidden />
            Walk-in Entry
          </span>
          <ChevronDown
            size={16}
            className={cn("text-muted-foreground transition-transform", walkInOpen && "rotate-180")}
            aria-hidden
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <StaffWalkInPanel
            successMessage={walkInSuccess}
            onDismissSuccess={() => setWalkInSuccess(null)}
            onBookingResolved={async bookingId => {
              suppressStaffJobAlert({ source: "booking", id: bookingId });
              const refreshed = await jobs.refetchToday();
              const match = refreshed.find(j => j.source !== "execution" && j.id === bookingId);
              const enriched = await jobs.loadJobWithPhotos(
                match ?? { source: "booking", id: bookingId, status: "scheduled" },
              );
              setFromWalkIn(true);
              setSelectedJob(enriched);
              onSelectJob(`booking-${bookingId}`);
              setWalkInOpen(false);
            }}
            onDcmsResolved={subscriptionId => {
              setWalkInOpen(false);
              navigate(`/staff/daily-clean?walkIn=1&subscriptionId=${subscriptionId}&visitType=cleaning`);
            }}
          />
        </CollapsibleContent>
      </Collapsible>

      {jobs.errorToday ? (
        <StaffErrorState onRetry={() => jobs.refetchToday()} />
      ) : jobs.loadingToday ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <StaffSkeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : jobs.today.length === 0 ? (
        <StaffEmptyState
          icon={<Calendar size={20} aria-hidden />}
          title="No service jobs today"
          description="Assigned jobs will show up here"
        />
      ) : (
        <div className="space-y-3">
          {jobs.today.map(job => (
            <button
              key={staffJobKey(job)}
              type="button"
              className="w-full text-left"
              onClick={() => {
                onSelectJob(staffJobKey(job));
                setLoadingDetail(true);
                void jobs.loadJobWithPhotos(job).then(enriched => {
                  setSelectedJob(enriched);
                  setLoadingDetail(false);
                });
              }}
            >
              <StaffJobListItem job={job} />
            </button>
          ))}
        </div>
      )}

      <Link href="/staff/jobs" className="block text-center text-xs font-semibold text-primary">
        All jobs (upcoming & done) →
      </Link>
    </div>
  );
}
