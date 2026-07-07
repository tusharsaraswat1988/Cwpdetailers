import { useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useStaffJobsData } from "@/hooks/useStaffJobsData";
import { StaffAccountGate } from "@/components/staff/StaffAccountGate";
import { StaffJobListItem } from "@/components/staff/StaffJobListItem";
import { StaffServiceJobFlow } from "@/components/staff/StaffServiceJobFlow";
import { StaffWalkInPanel } from "@/components/staff/StaffWalkInPanel";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar, ChevronDown, ChevronLeft, UserPlus } from "lucide-react";
import { staffJobKey, type StaffJob } from "@/lib/staff-jobs";
import { cn } from "@/lib/utils";

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
    if (!selectedJob) return;
    const match = jobs.today.find(j => staffJobKey(j) === staffJobKey(selectedJob));
    if (!match) return;
    void jobs.loadJobWithPhotos(match).then(setSelectedJob);
  }, [jobs.today, jobs.uploadingJobId]);

  useEffect(() => {
    if (!selectedJobKey || jobs.loadingToday) return;
    const match = jobs.today.find(j => staffJobKey(j) === selectedJobKey);
    if (!match) return;
    setLoadingDetail(true);
    void jobs.loadJobWithPhotos(match).then(enriched => {
      setSelectedJob(enriched);
      setLoadingDetail(false);
    });
  }, [selectedJobKey, jobs.loadingToday, jobs.today]);

  async function handleTransitionJob(jobId: number, toStatus: string, job?: StaffJob) {
    await jobs.transitionJob(jobId, toStatus, job);
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
    uploadGeoPhoto: jobs.uploadGeoPhoto,
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
          className="flex items-center gap-1 text-sm text-primary font-medium"
        >
          <ChevronLeft size={16} /> Jobs par wapas
        </button>
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div>
            <h2 className="font-display font-bold text-lg">{selectedJob.customerName}</h2>
            <p className="text-sm text-muted-foreground capitalize">
              {(selectedJob.serviceName ?? selectedJob.serviceType)?.replace(/_/g, " ")}
              {selectedJob.scheduledTime ? ` · ${selectedJob.scheduledTime}` : ""}
            </p>
          </div>
          {loadingDetail ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : (
            <StaffServiceJobFlow job={selectedJob} {...mutations} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Collapsible open={walkInOpen} onOpenChange={setWalkInOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm font-medium">
          <span className="flex items-center gap-2">
            <UserPlus size={16} className="text-primary" />
            Walk-in Entry
          </span>
          <ChevronDown size={16} className={cn("text-muted-foreground transition-transform", walkInOpen && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <StaffWalkInPanel
            successMessage={walkInSuccess}
            onDismissSuccess={() => setWalkInSuccess(null)}
            onBookingResolved={async bookingId => {
              await jobs.refetchToday();
              const enriched = await jobs.loadJobWithPhotos({
                source: "booking",
                id: bookingId,
                status: "scheduled",
              });
              setFromWalkIn(true);
              setSelectedJob(enriched);
              onSelectJob(`booking-${bookingId}`);
              setWalkInOpen(false);
            }}
            onDcmsResolved={(subscriptionId, visitType) => {
              setWalkInOpen(false);
              navigate(`/staff/daily-clean?walkIn=1&subscriptionId=${subscriptionId}&visitType=${visitType}`);
            }}
          />
        </CollapsibleContent>
      </Collapsible>

      {jobs.errorToday ? (
        <ErrorState onRetry={() => jobs.refetchToday()} />
      ) : jobs.loadingToday ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : jobs.today.length === 0 ? (
        <EmptyState
          icon={<Calendar size={20} />}
          title="Aaj koi service job nahi"
          description="Admin assign karte hi yahan dikhegi"
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

      <Link href="/staff/jobs" className="block text-center text-xs text-primary font-medium">
        Saari jobs (aane wali & done) →
      </Link>
    </div>
  );
}
