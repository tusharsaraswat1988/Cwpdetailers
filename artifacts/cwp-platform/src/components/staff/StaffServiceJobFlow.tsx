import { resolveMediaUrl } from "@/lib/media-url";
import {
  MapPin,
  Phone,
  ArrowRight,
  CheckCircle,
  Loader2,
  Route,
  ClipboardCheck,
  Navigation,
  Pause,
  Play,
  Copy,
  Check,
  Camera,
  Sun,
  Car,
  AlertCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { format, parseISO, isValid } from "date-fns";
import { StaffButton as Button, StaffStatusBadge } from "@/features/staff-ds";
import { Textarea } from "@/components/ui/textarea";
import { GeoPhotoSlotGrid } from "@/components/staff/GeoPhotoSlotGrid";
import { useToast } from "@/hooks/use-toast";
import {
  type StaffJob,
  REQUIRED_SERVICE_PHOTOS,
  countJobPhotos,
  canCompleteOtherServiceJob,
  getJobPhotoArrays,
} from "@/lib/staff-jobs";
import type { useStaffJobsData } from "@/hooks/useStaffJobsData";
import { buildNavigateUrl, canNavigateTo } from "@/lib/maps";

type Mutations = Pick<
  ReturnType<typeof useStaffJobsData>,
  | "transitionJob"
  | "uploadGeoPhoto"
  | "completeJobWithNotes"
  | "uploadingJobId"
  | "uploadingPhotoIndex"
  | "locatingJobId"
  | "isActionPending"
>;

interface Props extends Mutations {
  job: StaffJob;
}

function ServiceStepper({
  currentStep,
  isSolar,
}: {
  currentStep: "route" | "before" | "work" | "after" | "complete";
  isSolar: boolean;
}) {
  const steps = [
    { key: "route", label: "Route" },
    { key: "before", label: isSolar ? "Pre-Clean" : "Before" },
    { key: "work", label: isSolar ? "Solar Wash" : "Wash" },
    { key: "after", label: isSolar ? "Clean Array" : "After" },
    { key: "complete", label: "Done" },
  ];

  const stepOrder = ["route", "before", "work", "after", "complete"];
  const currentIndex = stepOrder.indexOf(currentStep);

  return (
    <div className="w-full pb-1" data-testid="service-job-stepper">
      <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground mb-1.5 px-0.5">
        <span>Lifecycle Step {currentIndex + 1} of 5</span>
        <span className="font-semibold text-primary capitalize">{steps[currentIndex]?.label}</span>
      </div>
      <div className="flex gap-1.5 h-1.5 w-full">
        {steps.map((s, idx) => {
          const isDone = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          return (
            <div
              key={s.key}
              className={`flex-1 rounded-full transition-all duration-300 ${
                isDone
                  ? "bg-emerald-600"
                  : isCurrent
                    ? "bg-primary"
                    : "bg-muted"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

function JobContactActions({ job, addressLine }: { job: StaffJob; addressLine: string | undefined }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  if (!job.customerPhone && !canNavigateTo(job) && !addressLine) return null;

  const handleCopy = () => {
    if (!addressLine) return;
    navigator.clipboard.writeText(addressLine);
    setCopied(true);
    toast({ title: "Address copied", description: addressLine });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex gap-2">
      {job.customerPhone && (
        <a
          href={`tel:${job.customerPhone}`}
          className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-muted"
          data-testid={`job-call-${job.id}`}
        >
          <Phone size={14} className="text-emerald-600" />
          <span>Call Customer</span>
        </a>
      )}

      {canNavigateTo(job) && (
        <a
          href={buildNavigateUrl(job)}
          target="_blank"
          rel="noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-xl border border-primary/30 bg-primary/10 text-xs font-semibold text-primary hover:bg-primary/20"
          data-testid={`job-navigate-${job.id}`}
        >
          <Navigation size={14} />
          <span>Directions</span>
        </a>
      )}

      {addressLine && (
        <button
          type="button"
          onClick={handleCopy}
          className="px-3 h-11 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center"
          title="Copy Address"
        >
          {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
        </button>
      )}
    </div>
  );
}

function JobDetailsCard({ job, addressLine }: { job: StaffJob; addressLine: string | undefined }) {
  const isSolar =
    job.taskType === "solar_cleaning" ||
    job.serviceType?.toLowerCase().includes("solar") ||
    job.serviceName?.toLowerCase().includes("solar");

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 text-sm staff-elevated">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-foreground">Job Details</p>
        {isSolar ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
            ☀️ Solar Cleaning
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
            🚗 Car Wash &amp; Care
          </span>
        )}
      </div>

      {job.vehicleName && (
        <div className="flex items-center gap-2 text-foreground font-medium">
          {isSolar ? <Sun size={15} className="text-amber-600 shrink-0" /> : <Car size={15} className="text-blue-600 shrink-0" />}
          <span>{isSolar ? `Solar Site: ${job.vehicleName}` : `Vehicle: ${job.vehicleName}`}</span>
        </div>
      )}

      {addressLine && (
        <div className="flex items-start gap-2 text-muted-foreground text-xs">
          <MapPin size={14} className="shrink-0 mt-0.5 text-primary" />
          <span>{addressLine}</span>
        </div>
      )}

      <div className="rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
        {isSolar
          ? "Guidelines: 3 before photos (array/dusty panels) → solar cleaning → 3 after photos (spotless clean array) → completion remark."
          : "Guidelines: 3 before photos (vehicle/wheels) → car washing → 3 after photos (spotless clean finish) → completion remark."}
      </div>
    </div>
  );
}

function formatCompletedAt(value: string | null | undefined) {
  if (!value) return null;
  const d = parseISO(value);
  return isValid(d) ? format(d, "d MMM yyyy, h:mm a") : value;
}

export function StaffServiceJobFlow({
  job,
  transitionJob,
  uploadGeoPhoto,
  completeJobWithNotes,
  uploadingJobId,
  uploadingPhotoIndex,
  locatingJobId,
  isActionPending,
}: Props) {
  const [accepted, setAccepted] = useState(false);
  const [onWay, setOnWay] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [readyForAfter, setReadyForAfter] = useState(false);
  const [remarks, setRemarks] = useState("");

  const { before, after } = countJobPhotos(job);

  useEffect(() => {
    setAccepted(false);
    setOnWay(false);
    setArrived(false);
    setReadyForAfter(after > 0);
    setRemarks(job.technicianNotes ?? "");
  }, [job.id, job.source, job.status, after, job.technicianNotes]);

  const btnClass = "w-full h-12 text-sm font-semibold rounded-xl";
  const isLocating = locatingJobId === job.id;
  const isUploading = uploadingJobId === job.id;
  const { beforePhotos, afterPhotos } = getJobPhotoArrays(job);
  const addressLine = job.area ? `${job.area}, ${job.address}` : job.address ?? undefined;
  const isSolar =
    job.taskType === "solar_cleaning" ||
    job.serviceType?.toLowerCase().includes("solar") ||
    job.serviceName?.toLowerCase().includes("solar");
  const isExecution = job.source === "execution";
  const beforeDone = before >= REQUIRED_SERVICE_PHOTOS;
  const afterDone = after >= REQUIRED_SERVICE_PHOTOS;
  const canComplete = canCompleteOtherServiceJob(job);

  const isAccepted = job.status === "confirmed" || (isExecution && job.status === "scheduled" && accepted);
  const isEnRoute =
    job.status === "en_route" || (isExecution && job.status === "scheduled" && accepted && onWay);

  const readyToStartWork = job.status === "en_route" && arrived && beforeDone;

  const onSiteForBefore =
    (job.status === "en_route" && arrived && !beforeDone) ||
    (job.status === "in_progress" && !beforeDone);

  const onSiteForWashing =
    job.status === "in_progress" && beforeDone && !readyForAfter && after === 0;

  const onSiteForAfter =
    job.status === "in_progress" && beforeDone && readyForAfter && !afterDone;

  const onSiteForWrapUp =
    job.status === "in_progress" && beforeDone && afterDone;

  if (job.status === "completed") {
    const completedLabel = formatCompletedAt(job.completedAt);
    return (
      <div className="space-y-4 py-3">
        <ServiceStepper currentStep="complete" isSolar={isSolar} />
        <div className="flex items-center justify-center gap-2 text-green-700 dark:text-green-300 text-sm font-semibold bg-green-500/10 border border-green-500/20 rounded-xl py-4">
          <CheckCircle size={18} className="text-green-600" /> Job Completed
        </div>
        {completedLabel && (
          <p className="text-center text-xs text-muted-foreground">
            Completed on {completedLabel}
          </p>
        )}
        {job.technicianNotes && (
          <div className="rounded-xl border border-border bg-card p-3 text-sm staff-elevated">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Technician Remark</p>
            <p className="text-foreground">{job.technicianNotes}</p>
          </div>
        )}
      </div>
    );
  }

  if (isExecution && job.status === "paused") {
    return (
      <div className="space-y-4">
        <ServiceStepper currentStep="work" isSolar={isSolar} />
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <p className="font-semibold text-amber-800">Work Paused</p>
          <p className="text-xs text-muted-foreground mt-1">Resume when you are ready to continue.</p>
        </div>
        <JobContactActions job={job} addressLine={addressLine} />
        <Button
          className={`${btnClass} bg-primary text-primary-foreground hover:bg-primary/90`}
          onClick={() => void transitionJob(job.id, "resume", job)}
          disabled={isActionPending}
          data-testid={`btn-resume-${job.id}`}
        >
          {isActionPending ? <Loader2 size={15} className="mr-2 animate-spin" /> : <Play size={15} className="mr-2" />}
          Resume Work
        </Button>
      </div>
    );
  }

  if (job.status === "scheduled" && !isExecution) {
    return (
      <div className="space-y-4">
        <ServiceStepper currentStep="route" isSolar={isSolar} />
        <JobDetailsCard job={job} addressLine={addressLine} />
        <JobContactActions job={job} addressLine={addressLine} />
        <Button
          className={`${btnClass} bg-orange-600 hover:bg-orange-700 text-white`}
          onClick={() => void transitionJob(job.id, "confirmed", job)}
          disabled={isActionPending}
          data-testid={`btn-accept-booking-${job.id}`}
        >
          <ClipboardCheck size={16} className="mr-2" />
          Accept Booking
        </Button>
      </div>
    );
  }

  if (isExecution && job.status === "scheduled" && !accepted) {
    return (
      <div className="space-y-4">
        <ServiceStepper currentStep="route" isSolar={isSolar} />
        <JobDetailsCard job={job} addressLine={addressLine} />
        <JobContactActions job={job} addressLine={addressLine} />
        <Button
          className={`${btnClass} bg-orange-600 hover:bg-orange-700 text-white`}
          onClick={() => setAccepted(true)}
          disabled={isActionPending}
          data-testid={`btn-accept-job-${job.id}`}
        >
          <ClipboardCheck size={16} className="mr-2" />
          Accept Job
        </Button>
      </div>
    );
  }

  if (isAccepted && !isEnRoute && job.status !== "in_progress") {
    return (
      <div className="space-y-4">
        <ServiceStepper currentStep="route" isSolar={isSolar} />
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
          <p className="font-semibold text-primary">Booking Accepted</p>
          <p className="text-xs text-muted-foreground mt-1">Customer site ke liye nikalne par &quot;On My Way&quot; dabayein.</p>
        </div>
        <JobContactActions job={job} addressLine={addressLine} />
        <Button
          className={`${btnClass} bg-orange-600 hover:bg-orange-700 text-white`}
          onClick={() => {
            if (isExecution) {
              setOnWay(true);
              return;
            }
            void transitionJob(job.id, "en_route", job);
          }}
          disabled={isActionPending}
          data-testid={`btn-en-route-${job.id}`}
        >
          {isLocating ? <Loader2 size={15} className="mr-2 animate-spin" /> : <Route size={15} className="mr-2" />}
          {isLocating ? "Getting location…" : "On My Way"}
        </Button>
      </div>
    );
  }

  if (isEnRoute && !arrived && job.status !== "in_progress") {
    return (
      <div className="space-y-4">
        <ServiceStepper currentStep="route" isSolar={isSolar} />
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4 text-sm">
          <p className="font-semibold text-orange-700">En Route</p>
          <p className="text-xs text-muted-foreground mt-1">Site par pahunch kar &quot;Arrived&quot; dabayein.</p>
        </div>
        <JobContactActions job={job} addressLine={addressLine} />
        <Button
          className={`${btnClass} bg-primary text-primary-foreground hover:bg-primary/90`}
          onClick={() => {
            if (isExecution) {
              void transitionJob(job.id, "in_progress", job);
              return;
            }
            setArrived(true);
          }}
          disabled={isActionPending}
          data-testid={`btn-arrived-${job.id}`}
        >
          {isLocating ? <Loader2 size={15} className="mr-2 animate-spin" /> : <MapPin size={15} className="mr-2" />}
          {isLocating ? "Getting location…" : "Arrived at Site"}
        </Button>
      </div>
    );
  }

  if (readyToStartWork) {
    return (
      <div className="space-y-5">
        <ServiceStepper currentStep="work" isSolar={isSolar} />
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
          <p className="font-semibold text-primary">Before Photos Uploaded</p>
          <p className="text-xs text-muted-foreground mt-1">
            {isSolar ? "Ab solar cleaning shuru karein. Kaam khatam hone ke baad clean panels ki photos lenge." : "Ab car wash shuru karein. Kaam khatam hone ke baad clean car ki photos lenge."}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {beforePhotos.map((photo, i) => (
            <div key={photo.url} className="aspect-square rounded-xl overflow-hidden border border-green-500/30 bg-black">
              <img src={resolveMediaUrl(photo.url)} alt={`Before ${i + 1}`} className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
        <Button
          className={`${btnClass} bg-primary text-primary-foreground hover:bg-primary/90`}
          onClick={() => void transitionJob(job.id, "in_progress", job)}
          disabled={isActionPending}
          data-testid={`btn-start-work-${job.id}`}
        >
          {isLocating ? <Loader2 size={15} className="mr-2 animate-spin" /> : <ArrowRight size={15} className="mr-2" />}
          {isLocating ? "Getting location…" : "Start Work"}
        </Button>
      </div>
    );
  }

  if (onSiteForBefore) {
    return (
      <div className="space-y-4">
        <ServiceStepper currentStep="before" isSolar={isSolar} />
        <div className="flex items-center justify-between">
          <StaffStatusBadge status={job.status === "in_progress" ? "in_progress" : "en_route"} />
          <p className="text-xs text-muted-foreground">
            {isSolar ? "Step 2: Uncleaned solar array photos" : "Step 2: Dirty vehicle photos"}
          </p>
        </div>
        <GeoPhotoSlotGrid
          label="Before Photos (Evidence)"
          description={`${REQUIRED_SERVICE_PHOTOS} geo-tagged photos required before starting service`}
          photos={beforePhotos}
          uploadingIndex={isUploading && uploadingPhotoIndex != null ? uploadingPhotoIndex : null}
          disabled={beforeDone}
          onCapture={file => void uploadGeoPhoto(job, "before", file, beforePhotos.length)}
        />
      </div>
    );
  }

  if (onSiteForWashing) {
    return (
      <div className="space-y-4">
        <ServiceStepper currentStep="work" isSolar={isSolar} />
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 text-sm space-y-1">
          <div className="flex items-center gap-2">
            <StaffStatusBadge status="in_progress" pulse />
            <p className="font-semibold text-blue-800">Service In Progress</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Step 3 — Complete the service carefully. When finished, take after photos.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 opacity-85">
          {beforePhotos.map((photo, i) => (
            <div key={photo.url} className="aspect-square rounded-xl overflow-hidden border border-green-500/30 bg-black">
              <img src={resolveMediaUrl(photo.url)} alt={`Before ${i + 1}`} className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
        {isExecution && (
          <Button
            variant="outline"
            className={btnClass}
            onClick={() => void transitionJob(job.id, "paused", job)}
            disabled={isActionPending}
            data-testid={`btn-pause-${job.id}`}
          >
            <Pause size={15} className="mr-2" />
            Pause Work
          </Button>
        )}
        <Button
          className={`${btnClass} bg-primary text-primary-foreground hover:bg-primary/90`}
          onClick={() => setReadyForAfter(true)}
          disabled={isActionPending}
          data-testid={`btn-wash-done-${job.id}`}
        >
          <CheckCircle size={15} className="mr-2" />
          Service Done — After Photos
        </Button>
      </div>
    );
  }

  if (onSiteForAfter) {
    return (
      <div className="space-y-4">
        <ServiceStepper currentStep="after" isSolar={isSolar} />
        <div className="flex items-center justify-between">
          <StaffStatusBadge status="in_progress" pulse />
          <p className="text-xs text-muted-foreground">
            {isSolar ? "Step 4: Clean solar array photos" : "Step 4: Clean vehicle photos"}
          </p>
        </div>

        <GeoPhotoSlotGrid
          label="After Photos (Clean Proof)"
          description={`${REQUIRED_SERVICE_PHOTOS} geo-tagged photos required showing completed clean`}
          photos={afterPhotos}
          uploadingIndex={isUploading && uploadingPhotoIndex != null ? uploadingPhotoIndex : null}
          disabled={false}
          onCapture={file => void uploadGeoPhoto(job, "after", file, afterPhotos.length)}
        />
      </div>
    );
  }

  if (onSiteForWrapUp || canComplete) {
    return (
      <div className="space-y-4">
        <ServiceStepper currentStep="complete" isSolar={isSolar} />
        <div className="flex items-center justify-between">
          <StaffStatusBadge status="in_progress" pulse />
          <p className="text-xs text-muted-foreground">Step 5 — Remarks &amp; Complete</p>
        </div>

        <div className="space-y-2">
          <label htmlFor={`remarks-${job.id}`} className="text-xs font-semibold text-foreground">
            Technician Notes &amp; Observations (Optional)
          </label>
          <Textarea
            id={`remarks-${job.id}`}
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            placeholder="Ex: Scratch near rear bumper noted, cleaned extra dirty glass..."
            rows={3}
            className="text-xs resize-none rounded-xl"
          />
        </div>

        <Button
          className={`${btnClass} bg-emerald-600 hover:bg-emerald-700 text-white`}
          onClick={() => void completeJobWithNotes(job, remarks)}
          disabled={isActionPending || !canComplete}
          data-testid={`btn-complete-${job.id}`}
        >
          {isLocating ? <Loader2 size={15} className="mr-2 animate-spin" /> : <CheckCircle size={15} className="mr-2" />}
          {isLocating ? "Verifying location…" : "Submit & Complete Job"}
        </Button>
      </div>
    );
  }

  return null;
}
