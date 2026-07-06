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
import { transitionBookingWithLocation } from "@/lib/location";
import {
  type StaffJob,
  executionToStaffJob,
  partitionStaffJobs,
  pickActiveJob,
} from "@/lib/staff-jobs";
import {
  fetchTodayExecutions,
  fetchStaffExecutions,
  startExecution,
  completeExecution,
  SERVICE_EXECUTIONS_QUERY_KEY,
} from "@/features/service-executions/api";

function getStaffGps(): Promise<{ latitude: number; longitude: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("GPS not available"));
    navigator.geolocation.getCurrentPosition(
      pos => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
      err => reject(err),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  });
}

function mergeJobs(bookings: StaffJob[], executions: StaffJob[]) {
  return [...bookings.map(b => ({ ...b, source: "booking" as const })), ...executions];
}

export function useStaffJobsData() {
  const { staffId, isLoading: scopeLoading, missingStaffLink } = useAccountScope();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [uploadingJobId, setUploadingJobId] = useState<number | null>(null);
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
      const gps = await getStaffGps();
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
  const today = mergeJobs(bookingToday, executionToday);

  const bookingAll = (allBookings?.data ?? []) as StaffJob[];
  const executionAll = (allExecutions ?? []).map(executionToStaffJob);
  const all = mergeJobs(bookingAll, executionAll);

  const { upcoming, done } = partitionStaffJobs(all, today);
  const activeJob = pickActiveJob(today);
  const remainingToday = activeJob ? today.filter(j => j.id !== activeJob.id || j.source !== activeJob.source) : today;

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
    locatingJobId,
    transitionJob,
    uploadPhoto,
    isActionPending: transitionMutation.isPending || executionMutation.isPending || updateMutation.isPending || locatingJobId != null,
  };
}
