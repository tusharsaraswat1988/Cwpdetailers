import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
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

export function StaffOtherServicesPanel({ selectedJobKey, onSelectJob }: Props) {
  const jobs = useStaffJobsData();
  const [, navigate] = useLocation();
  const [selectedJob, setSelectedJob] = useState<StaffJob | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [walkInOpen, setWalkInOpen] = useState(false);

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
    transitionJob: jobs.transitionJob,
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
          }}
          className="flex items-center gap-1 text-sm text-primary font-medium"
        >
          <ChevronLeft size={16} /> Back to jobs
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
            Walk-in entry
          </span>
          <ChevronDown size={16} className={cn("text-muted-foreground transition-transform", walkInOpen && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <StaffWalkInPanel
            onBookingResolved={async bookingId => {
              await jobs.refetchToday();
              const enriched = await jobs.loadJobWithPhotos({
                source: "booking",
                id: bookingId,
                status: "scheduled",
              });
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
          title="No service jobs today"
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
        All jobs (upcoming & done) →
      </Link>
    </div>
  );
}
