import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useAccountScope } from "@/lib/account-scope";
import { uploadFileToCloudinary, resolveMediaUrl } from "@/lib/media-url";
import {
  useGetTodayBookings, getGetTodayBookingsQueryKey,
  useListBookings, getListBookingsQueryKey,
  useTransitionBooking, useUpdateBooking,
  useRequestUploadUrl,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import StaffLayout from "@/components/layout/StaffLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { useToast } from "@/hooks/use-toast";
import { Calendar, CheckCircle, Clock, MapPin, Camera, Phone, Route, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

type Job = {
  id: number; customerName?: string; customerPhone?: string;
  serviceType?: string | null; serviceName?: string | null;
  scheduledDate?: string; scheduledTime?: string | null;
  status?: string; address?: string | null; area?: string | null;
  beforePhotoUrl?: string | null;
  afterPhotoUrl?: string | null;
};

export default function StaffDashboard() {
  const { user } = useAuth();
  const { staffId, isLoading: scopeLoading, missingStaffLink } = useAccountScope();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"today" | "upcoming" | "done">("today");
  const [uploadingJobId, setUploadingJobId] = useState<number | null>(null);

  const { data: todayJobs, isLoading: loadingToday, isError: errorToday, refetch: refetchToday } = useGetTodayBookings({ staffId: staffId ?? 0 }, {
    query: {
      queryKey: getGetTodayBookingsQueryKey({ staffId: staffId ?? 0 }),
      enabled: staffId != null,
    },
  });

  const { data: allJobs, isLoading: loadingAll, isError: errorAll, refetch: refetchAll } = useListBookings({ staffId: staffId ?? 0, limit: 100 }, {
    query: {
      queryKey: getListBookingsQueryKey({ staffId: staffId ?? 0, limit: 100 }),
      enabled: staffId != null,
    },
  });

  const invalidateJobs = () => {
    qc.invalidateQueries({ queryKey: getGetTodayBookingsQueryKey() });
    qc.invalidateQueries({ queryKey: getListBookingsQueryKey() });
  };

  const transitionMutation = useTransitionBooking({
    mutation: {
      onSuccess: () => { invalidateJobs(); toast({ title: "Status updated" }); },
      onError: (e: any) => toast({ title: e?.response?.data?.error || "Transition failed", variant: "destructive" }),
    },
  });

  const updateMutation = useUpdateBooking({
    mutation: {
      onSuccess: () => { invalidateJobs(); toast({ title: "Photo saved" }); },
      onError: (e: any) => toast({ title: e?.response?.data?.error || "Upload failed", variant: "destructive" }),
    },
  });

  const requestUrlMutation = useRequestUploadUrl({
    mutation: {
      onError: (e: any) => toast({ title: e?.response?.data?.error || "Presign failed", variant: "destructive" }),
    },
  });

  const all = (allJobs?.data ?? []) as Job[];
  const today = (todayJobs ?? []) as Job[];
  const todayStr = new Date().toISOString().split("T")[0];
  const upcoming = all.filter(j => j.scheduledDate && j.scheduledDate > todayStr && j.status !== "completed" && j.status !== "cancelled");
  const done = all.filter(j => j.status === "completed" || j.status === "cancelled");

  const displayJobs = activeTab === "today" ? today : activeTab === "upcoming" ? upcoming : done;
  const isLoading = activeTab === "today" ? loadingToday : loadingAll;
  const isError = activeTab === "today" ? errorToday : errorAll;
  const refetch = activeTab === "today" ? refetchToday : refetchAll;

  async function uploadPhoto(jobId: number, field: "beforePhotoUrl" | "afterPhotoUrl", file: File) {
    if (staffId == null) return;
    setUploadingJobId(jobId);
    try {
      const presign = await requestUrlMutation.mutateAsync({ data: { name: file.name, size: file.size, contentType: file.type } });
      const secureUrl = await uploadFileToCloudinary(file, presign as any);
      await updateMutation.mutateAsync({ id: jobId, data: { [field]: secureUrl } });
    } catch {
      toast({ title: "Photo upload failed", variant: "destructive" });
    } finally {
      setUploadingJobId(null);
    }
  }

  if (scopeLoading) {
    return (
      <StaffLayout>
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </StaffLayout>
    );
  }

  if (missingStaffLink || staffId == null) {
    return (
      <StaffLayout>
        <div className="max-w-md mx-auto text-center space-y-2 py-12">
          <p className="font-semibold">Account not linked</p>
          <p className="text-sm text-muted-foreground">Your login is not linked to a staff profile. Ask your admin to create your staff account.</p>
        </div>
      </StaffLayout>
    );
  }

  const completedToday = today.filter(j => j.status === "completed").length;

  return (
    <StaffLayout>
      <div className="space-y-5">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display font-bold text-xl">
            Good {new Date().getHours() < 12 ? "morning" : "afternoon"}, {user?.name?.split(" ")[0]}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </motion.div>

        {/* Compact stat chips row — QW-14 */}
        <div className="flex gap-2" data-testid="staff-stats-row">
          {[
            { label: "Today", value: today.length, icon: Calendar, color: "text-primary" },
            { label: "Done", value: completedToday, icon: CheckCircle, color: "text-green-600" },
            { label: "Upcoming", value: upcoming.length, icon: Clock, color: "text-amber-500" },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="flex-1 bg-card border border-border rounded-xl p-3 text-center" data-testid={`staff-stat-${s.label.toLowerCase()}`}>
              <s.icon size={14} className={`${s.color} mx-auto mb-1`} />
              {isLoading ? <Skeleton className="h-5 w-8 mx-auto" /> : (
                <p className={`font-display font-bold text-lg ${s.color}`}>{s.value}</p>
              )}
              <p className="text-muted-foreground text-[10px] mt-0.5">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Tab bar */}
        <div className="flex gap-0 border-b border-border">
          {(["today", "upcoming", "done"] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors -mb-px ${activeTab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t === "today" ? `Today (${today.length})` : t === "upcoming" ? `Upcoming (${upcoming.length})` : `Done (${done.length})`}
            </button>
          ))}
        </div>

        {/* Job list */}
        <div className="space-y-3">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)
            : isError
            ? <ErrorState onRetry={() => refetch()} />
            : displayJobs.length === 0
            ? (
              <EmptyState
                icon={<Calendar size={20} />}
                title={activeTab === "today" ? "No jobs today" : activeTab === "upcoming" ? "No upcoming jobs" : "No completed jobs yet"}
                description={activeTab === "today" ? "Check back after your manager assigns today's schedule" : undefined}
              />
            )
            : displayJobs.map((job, i) => (
              <motion.div key={job.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                className="bg-card border border-border rounded-xl p-4 space-y-3" data-testid={`job-card-${job.id}`}>

                {/* Job header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{job.customerName}</p>
                    <p className="text-xs text-muted-foreground capitalize mt-0.5">
                      {job.serviceType?.replace(/_/g, " ")}{job.scheduledTime ? ` · ${job.scheduledTime}` : ""}
                    </p>
                    {(job.address || job.area) && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <MapPin size={10} className="shrink-0" />
                        <span className="truncate">{job.area ? `${job.area}, ${job.address}` : job.address}</span>
                      </div>
                    )}
                  </div>
                  {/* QW-03: use StatusBadge */}
                  <StatusBadge status={job.status ?? "scheduled"} className="shrink-0" />
                </div>

                {/* QW-02: Contact actions */}
                {(job.customerPhone || job.address) && (
                  <div className="flex gap-2">
                    {job.customerPhone && (
                      <a href={`tel:${job.customerPhone}`}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        data-testid={`job-call-${job.id}`}>
                        <Phone size={13} className="text-green-600" />
                        Call
                      </a>
                    )}
                    {job.address && (
                      <a href={`https://maps.google.com/?q=${encodeURIComponent((job.area ? `${job.area} ` : "") + (job.address ?? ""))}`}
                        target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        data-testid={`job-navigate-${job.id}`}>
                        <MapPin size={13} className="text-blue-500" />
                        Navigate
                      </a>
                    )}
                  </div>
                )}

                {/* Photo thumbnails */}
                {(job.beforePhotoUrl || job.afterPhotoUrl) && (
                  <div className="flex gap-3">
                    {job.beforePhotoUrl && (
                      <div className="text-center">
                        <img src={resolveMediaUrl(job.beforePhotoUrl)} alt="Before" className="h-16 w-16 rounded-lg object-cover bg-muted border border-border" />
                        <p className="text-[10px] text-muted-foreground mt-0.5">Before</p>
                      </div>
                    )}
                    {job.afterPhotoUrl && (
                      <div className="text-center">
                        <img src={resolveMediaUrl(job.afterPhotoUrl)} alt="After" className="h-16 w-16 rounded-lg object-cover bg-muted border border-border" />
                        <p className="text-[10px] text-muted-foreground mt-0.5">After</p>
                      </div>
                    )}
                  </div>
                )}

                {/* QW-01: Action buttons — full-width, h-12 minimum */}
                <div className="flex flex-col gap-2">
                  {job.status === "scheduled" && (
                    <Button className="w-full h-12 text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white"
                      onClick={() => transitionMutation.mutate({ id: job.id, data: { toStatus: "en_route" } })}
                      disabled={transitionMutation.isPending}
                      data-testid={`btn-en-route-${job.id}`}>
                      <Route size={15} className="mr-2" /> On My Way
                    </Button>
                  )}
                  {job.status === "en_route" && !job.beforePhotoUrl && (
                    <Button className="w-full h-12 text-sm font-semibold relative" variant="outline"
                      disabled={uploadingJobId === job.id}
                      data-testid={`btn-before-photo-${job.id}`}>
                      <Camera size={15} className="mr-2" />
                      {uploadingJobId === job.id ? "Uploading..." : "Take Before Photo"}
                      <input type="file" accept="image/*" capture="environment" className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(job.id, "beforePhotoUrl", f); e.target.value = ""; }} />
                    </Button>
                  )}
                  {job.status === "en_route" && job.beforePhotoUrl && (
                    <Button className="w-full h-12 text-sm font-semibold bg-primary text-secondary hover:bg-primary/90"
                      onClick={() => transitionMutation.mutate({ id: job.id, data: { toStatus: "in_progress" } })}
                      disabled={transitionMutation.isPending}
                      data-testid={`btn-start-job-${job.id}`}>
                      <ArrowRight size={15} className="mr-2" /> Start Job
                    </Button>
                  )}
                  {job.status === "in_progress" && !job.afterPhotoUrl && (
                    <Button className="w-full h-12 text-sm font-semibold relative" variant="outline"
                      disabled={uploadingJobId === job.id}
                      data-testid={`btn-after-photo-${job.id}`}>
                      <Camera size={15} className="mr-2" />
                      {uploadingJobId === job.id ? "Uploading..." : "Take After Photo"}
                      <input type="file" accept="image/*" capture="environment" className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(job.id, "afterPhotoUrl", f); e.target.value = ""; }} />
                    </Button>
                  )}
                  {job.status === "in_progress" && job.afterPhotoUrl && (
                    <Button className="w-full h-12 text-sm font-semibold bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => transitionMutation.mutate({ id: job.id, data: { toStatus: "completed" } })}
                      disabled={transitionMutation.isPending}
                      data-testid={`btn-complete-${job.id}`}>
                      <CheckCircle size={15} className="mr-2" /> Mark Complete
                    </Button>
                  )}
                  {job.status === "completed" && (
                    <div className="flex items-center justify-center gap-2 py-3 text-green-600 text-sm font-medium bg-green-500/10 rounded-xl">
                      <CheckCircle size={15} /> Job completed
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
        </div>
      </div>
    </StaffLayout>
  );
}
