import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
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
  partitionStaffJobs,
  pickActiveJob,
} from "@/lib/staff-jobs";

export function useStaffJobsData() {
  const { staffId, isLoading: scopeLoading, missingStaffLink } = useAccountScope();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [uploadingJobId, setUploadingJobId] = useState<number | null>(null);
  const [locatingJobId, setLocatingJobId] = useState<number | null>(null);

  const { data: todayJobs, isLoading: loadingToday, isError: errorToday, refetch: refetchToday } =
    useGetTodayBookings(
      { staffId: staffId ?? 0 },
      {
        query: {
          queryKey: getGetTodayBookingsQueryKey({ staffId: staffId ?? 0 }),
          enabled: staffId != null,
        },
      },
    );

  const { data: allJobs, isLoading: loadingAll, isError: errorAll, refetch: refetchAll } = useListBookings(
    { staffId: staffId ?? 0, limit: 100 },
    {
      query: {
        queryKey: getListBookingsQueryKey({ staffId: staffId ?? 0, limit: 100 }),
        enabled: staffId != null,
      },
    },
  );

  const invalidateJobs = () => {
    qc.invalidateQueries({ queryKey: getGetTodayBookingsQueryKey() });
    qc.invalidateQueries({ queryKey: getListBookingsQueryKey() });
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

  const all = (allJobs?.data ?? []) as StaffJob[];
  const today = (todayJobs ?? []) as StaffJob[];
  const { upcoming, done } = partitionStaffJobs(all, today);
  const activeJob = pickActiveJob(today);
  const remainingToday = activeJob ? today.filter(j => j.id !== activeJob.id) : today;

  async function transitionJob(jobId: number, toStatus: string) {
    setLocatingJobId(jobId);
    try {
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
    isActionPending: transitionMutation.isPending || updateMutation.isPending || locatingJobId != null,
  };
}
