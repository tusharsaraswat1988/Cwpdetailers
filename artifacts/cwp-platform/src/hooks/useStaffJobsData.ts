import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  useGetTodayBookings,
  getGetTodayBookingsQueryKey,
  useListBookings,
  getListBookingsQueryKey,
  useUpdateBooking,
  useRequestUploadUrl,
} from "@workspace/api-client-react";
import { useAccountScope } from "@/lib/account-scope";
import { uploadFileToCloudinary } from "@/lib/media-url";
import { useToast } from "@/hooks/use-toast";
import { getStaffLocation, transitionBookingWithLocation } from "@/lib/location";
import {
  type StaffJob,
  type GeoTaggedPhoto,
  executionToStaffJob,
  partitionStaffJobs,
  pickActiveJob,
  isOtherServiceJob,
  partitionJobsByCategory,
  REQUIRED_SERVICE_PHOTOS,
} from "@/lib/staff-jobs";
import {
  fetchTodayExecutions,
  fetchStaffExecutions,
  fetchExecutionDetail,
  startExecution,
  completeExecution,
  addExecutionPhotos,
  SERVICE_EXECUTIONS_QUERY_KEY,
} from "@/features/service-executions/api";

function enrichBookingJob(job: StaffJob): StaffJob {
  const proof = job.proofPhotoUrls ?? [];
  if (proof.length >= REQUIRED_SERVICE_PHOTOS * 2) {
    const beforePhotos: GeoTaggedPhoto[] = proof.slice(0, REQUIRED_SERVICE_PHOTOS).map(url => ({
      url,
      latitude: 0,
      longitude: 0,
    }));
    const afterPhotos: GeoTaggedPhoto[] = proof.slice(REQUIRED_SERVICE_PHOTOS, REQUIRED_SERVICE_PHOTOS * 2).map(url => ({
      url,
      latitude: 0,
      longitude: 0,
    }));
    return {
      ...job,
      beforePhotos,
      afterPhotos,
      beforePhotoUrl: beforePhotos[0]?.url ?? job.beforePhotoUrl,
      afterPhotoUrl: afterPhotos[0]?.url ?? job.afterPhotoUrl,
    };
  }
  return job;
}

function enrichExecutionJob(
  job: StaffJob,
  photos: { kind: string; url: string; latitude: number | null; longitude: number | null; accuracy?: number | null }[],
): StaffJob {
  const beforePhotos: GeoTaggedPhoto[] = photos
    .filter(p => p.kind === "before")
    .map(p => ({
      url: p.url,
      latitude: p.latitude ?? 0,
      longitude: p.longitude ?? 0,
      accuracy: p.accuracy ?? undefined,
    }));
  const afterPhotos: GeoTaggedPhoto[] = photos
    .filter(p => p.kind === "after")
    .map(p => ({
      url: p.url,
      latitude: p.latitude ?? 0,
      longitude: p.longitude ?? 0,
      accuracy: p.accuracy ?? undefined,
    }));
  return {
    ...job,
    beforePhotos,
    afterPhotos,
    beforePhotoUrl: beforePhotos[0]?.url,
    afterPhotoUrl: afterPhotos[0]?.url,
  };
}

function enrichJob(job: StaffJob): StaffJob {
  if (job.source === "execution") return job;
  return enrichBookingJob(job);
}

function mergeJobs(bookings: StaffJob[], executions: StaffJob[]) {
  return [
    ...bookings.map(b => enrichJob({ ...b, source: "booking" as const })),
    ...executions.map(e => enrichJob(e)),
  ];
}

export function useStaffJobsData() {
  const { staffId, isLoading: scopeLoading, missingStaffLink } = useAccountScope();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [uploadingJobId, setUploadingJobId] = useState<number | null>(null);
  const [uploadingPhotoIndex, setUploadingPhotoIndex] = useState<number | null>(null);
  const [locatingJobId, setLocatingJobId] = useState<number | null>(null);

  const queryOpts = {
    enabled: staffId != null,
    refetchInterval: 30_000 as const,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  };

  const { data: todayBookings, isLoading: loadingTodayBookings, isError: errorTodayBookings, refetch: refetchTodayBookings } =
    useGetTodayBookings(
      { staffId: staffId ?? 0 },
      {
        query: {
          queryKey: getGetTodayBookingsQueryKey({ staffId: staffId ?? 0 }),
          ...queryOpts,
        },
      },
    );

  const { data: todayExecutions, isLoading: loadingTodayExecutions, isError: errorTodayExecutions, refetch: refetchTodayExecutions } =
    useQuery({
      queryKey: [...SERVICE_EXECUTIONS_QUERY_KEY, "today", staffId],
      queryFn: fetchTodayExecutions,
      ...queryOpts,
    });

  const { data: allBookings, isLoading: loadingAllBookings, isError: errorAllBookings, refetch: refetchAllBookings } = useListBookings(
    { staffId: staffId ?? 0, limit: 100 },
    {
      query: {
        queryKey: getListBookingsQueryKey({ staffId: staffId ?? 0, limit: 100 }),
        enabled: staffId != null,
        refetchInterval: 60_000,
        refetchOnWindowFocus: true,
      },
    },
  );

  const { data: allExecutions, isLoading: loadingAllExecutions, isError: errorAllExecutions, refetch: refetchAllExecutions } =
    useQuery({
      queryKey: [...SERVICE_EXECUTIONS_QUERY_KEY, "all", staffId],
      queryFn: () => fetchStaffExecutions(100),
      enabled: staffId != null,
      refetchInterval: 60_000,
      refetchOnWindowFocus: true,
    });

  const invalidateJobs = () => {
    qc.invalidateQueries({ queryKey: getGetTodayBookingsQueryKey() });
    qc.invalidateQueries({ queryKey: getListBookingsQueryKey() });
    qc.invalidateQueries({ queryKey: SERVICE_EXECUTIONS_QUERY_KEY });
  };

  const transitionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { toStatus: string; reason?: string } }) =>
      transitionBookingWithLocation(id, data),
    onSuccess: () => {
      invalidateJobs();
      toast({ title: "Status updated" });
    },
    onError: (err: Error) =>
      toast({ title: "Action blocked", description: err.message, variant: "destructive" }),
  });

  const executionMutation = useMutation({
    mutationFn: async ({ job, toStatus }: { job: StaffJob; toStatus: string }) => {
      const executionId = job.executionId ?? job.id;
      const gps = await getStaffLocation("action");
      if (toStatus === "in_progress") {
        return startExecution(executionId, gps);
      }
      if (toStatus === "completed") {
        return completeExecution(executionId, gps);
      }
      throw new Error("Unsupported action for this job");
    },
    onSuccess: () => {
      invalidateJobs();
      toast({ title: "Status updated" });
    },
    onError: (err: Error) =>
      toast({ title: "Action blocked", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useUpdateBooking({
    mutation: {
      onSuccess: () => {
        invalidateJobs();
        toast({ title: "Photo saved" });
      },
      onError: (e: { response?: { data?: { error?: string } } }) =>
        toast({ title: e?.response?.data?.error || "Upload failed", variant: "destructive" }),
    },
  });

  const requestUrlMutation = useRequestUploadUrl({
    mutation: {
      onError: (e: { response?: { data?: { error?: string } } }) =>
        toast({ title: e?.response?.data?.error || "Presign failed", variant: "destructive" }),
    },
  });

  const bookingToday = (todayBookings ?? []) as StaffJob[];
  const executionToday = (todayExecutions ?? []).map(executionToStaffJob);
  const todayRaw = mergeJobs(bookingToday, executionToday);
  const today = todayRaw.filter(isOtherServiceJob);

  const bookingAll = (allBookings?.data ?? []) as StaffJob[];
  const executionAll = (allExecutions ?? []).map(executionToStaffJob);
  const allRaw = mergeJobs(bookingAll, executionAll);
  const all = allRaw.filter(isOtherServiceJob);

  const { upcoming, done } = partitionStaffJobs(all, today);
  const activeJob = pickActiveJob(today);
  const remainingToday = activeJob
    ? today.filter(j => j.id !== activeJob.id || j.source !== activeJob.source)
    : today;
  const { otherServices: todayOtherServices } = partitionJobsByCategory(todayRaw);

  async function transitionJob(jobId: number, toStatus: string, job?: StaffJob) {
    setLocatingJobId(jobId);
    try {
      if (job?.source === "execution") {
        await executionMutation.mutateAsync({ job, toStatus });
        return;
      }
      await transitionMutation.mutateAsync({ id: jobId, data: { toStatus } });
    } finally {
      setLocatingJobId(null);
    }
  }

  async function uploadPhoto(jobId: number, field: "beforePhotoUrl" | "afterPhotoUrl", file: File) {
    if (staffId == null) return;
    setUploadingJobId(jobId);
    try {
      const presign = await requestUrlMutation.mutateAsync({
        data: { name: file.name, size: file.size, contentType: file.type },
      });
      const secureUrl = await uploadFileToCloudinary(file, presign as Parameters<typeof uploadFileToCloudinary>[1]);
      await updateMutation.mutateAsync({ id: jobId, data: { [field]: secureUrl } });
    } catch {
      toast({ title: "Photo upload failed", variant: "destructive" });
    } finally {
      setUploadingJobId(null);
    }
  }

  async function uploadGeoPhoto(job: StaffJob, kind: "before" | "after", file: File, photoIndex: number) {
    setUploadingJobId(job.id);
    setUploadingPhotoIndex(photoIndex);
    try {
      const gps = await getStaffLocation("action");
      const presign = await requestUrlMutation.mutateAsync({
        data: { name: file.name, size: file.size, contentType: file.type },
      });
      const secureUrl = await uploadFileToCloudinary(file, presign as Parameters<typeof uploadFileToCloudinary>[1]);

      if (job.source === "execution") {
        const executionId = job.executionId ?? job.id;
        await addExecutionPhotos(executionId, [{
          kind,
          url: secureUrl,
          latitude: gps.latitude,
          longitude: gps.longitude,
          accuracy: gps.accuracy,
        }]);
        invalidateJobs();
        toast({ title: "Photo saved with location" });
        return;
      }

      const currentBefore = job.beforePhotos?.map(p => p.url) ?? job.proofPhotoUrls?.slice(0, REQUIRED_SERVICE_PHOTOS) ?? [];
      const currentAfter = job.afterPhotos?.map(p => p.url) ?? job.proofPhotoUrls?.slice(REQUIRED_SERVICE_PHOTOS, REQUIRED_SERVICE_PHOTOS * 2) ?? [];
      const nextBefore = kind === "before" ? [...currentBefore, secureUrl] : currentBefore;
      const nextAfter = kind === "after" ? [...currentAfter, secureUrl] : currentAfter;
      const nextProof = [...nextBefore, ...nextAfter];

      await updateMutation.mutateAsync({
        id: job.id,
        data: {
          proofPhotoUrls: nextProof,
          beforePhotoUrl: nextBefore[0] ?? job.beforePhotoUrl,
          afterPhotoUrl: nextAfter[0] ?? job.afterPhotoUrl,
        },
      });
    } catch (err) {
      toast({
        title: "Photo upload failed",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setUploadingJobId(null);
      setUploadingPhotoIndex(null);
    }
  }

  async function loadJobWithPhotos(job: StaffJob): Promise<StaffJob> {
    if (job.source !== "execution") return enrichBookingJob(job);
    const detail = await fetchExecutionDetail(job.executionId ?? job.id);
    return enrichExecutionJob(job, detail.photos);
  }

  const loadingToday = loadingTodayBookings || loadingTodayExecutions;
  const loadingAll = loadingAllBookings || loadingAllExecutions;
  const errorToday = errorTodayBookings || errorTodayExecutions;
  const errorAll = errorAllBookings || errorAllExecutions;

  const refetchToday = () => {
    void refetchTodayBookings();
    void refetchTodayExecutions();
  };

  const refetchAll = () => {
    void refetchAllBookings();
    void refetchAllExecutions();
  };

  return {
    staffId,
    scopeLoading,
    missingStaffLink,
    today,
    todayAll: todayRaw,
    todayOtherServices,
    upcoming,
    done,
    all,
    activeJob,
    remainingToday,
    loadingToday,
    loadingAll,
    errorToday,
    errorAll,
    refetchToday,
    refetchAll,
    uploadingJobId,
    uploadingPhotoIndex,
    locatingJobId,
    transitionJob,
    uploadPhoto,
    uploadGeoPhoto,
    loadJobWithPhotos,
    isActionPending:
      transitionMutation.isPending
      || executionMutation.isPending
      || updateMutation.isPending
      || locatingJobId != null,
  };
}
