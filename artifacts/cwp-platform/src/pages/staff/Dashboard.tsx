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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Calendar, CheckCircle, Clock, MapPin, Camera, Route, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const statusColors: Record<string, string> = {
  scheduled: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  en_route: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  in_progress: "bg-primary/10 text-primary border-primary/20",
  completed: "bg-green-500/10 text-green-600 border-green-500/20",
  cancelled: "bg-red-500/10 text-red-600 border-red-500/20",
  rescheduled: "bg-violet-500/10 text-violet-600 border-violet-500/20",
};

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

  const { data: todayJobs, isLoading: loadingToday } = useGetTodayBookings({ staffId: staffId ?? 0 }, {
    query: {
      queryKey: getGetTodayBookingsQueryKey({ staffId: staffId ?? 0 }),
      enabled: staffId != null,
    },
  });

  const { data: allJobs, isLoading: loadingAll } = useListBookings({ staffId: staffId ?? 0, limit: 100 }, {
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
        <div className="p-6"><Skeleton className="h-8 w-48" /></div>
      </StaffLayout>
    );
  }

  if (missingStaffLink || staffId == null) {
    return (
      <StaffLayout>
        <div className="p-6 max-w-md mx-auto text-center space-y-2">
          <p className="font-semibold">Account not linked</p>
          <p className="text-sm text-muted-foreground">Your login is not linked to a staff profile. Ask your admin to create your staff account.</p>
        </div>
      </StaffLayout>
    );
  }

  return (
    <StaffLayout>
      <div className="p-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display font-bold text-2xl">Good morning, {user?.name?.split(" ")[0]}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
        </motion.div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Today's", value: today.length, icon: Calendar },
            { label: "Completed", value: today.filter(j => j.status === "completed").length, icon: CheckCircle },
            { label: "Upcoming", value: upcoming.length, icon: Clock },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
              <div className="bg-card border border-border rounded-xl p-4 text-center" data-testid={`staff-stat-${s.label.toLowerCase()}`}>
                <s.icon size={18} className="text-primary mx-auto mb-2" />
                {isLoading ? <Skeleton className="h-6 w-8 mx-auto" /> : <p className="font-display font-bold text-2xl text-primary">{s.value}</p>}
                <p className="text-muted-foreground text-xs mt-0.5">{s.label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="flex gap-2 border-b border-border">
          {(["today", "upcoming", "done"] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${activeTab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {isLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />) :
            displayJobs.map((job, i) => (
              <motion.div key={job.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-card border border-border rounded-xl p-4" data-testid={`job-card-${job.id}`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="font-semibold text-sm">{job.customerName}</p>
                    <p className="text-xs text-muted-foreground capitalize">{job.serviceType?.replace(/_/g, " ")} {job.scheduledTime ? `· ${job.scheduledTime}` : ""}</p>
                    {job.address && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <MapPin size={10} />
                        <span>{job.area ? `${job.area}, ${job.address}` : job.address}</span>
                      </div>
                    )}
                  </div>
                  <Badge variant="outline" className={`text-xs capitalize flex-shrink-0 ${statusColors[job.status ?? "scheduled"]}`}>
                    {job.status?.replace(/_/g, " ")}
                  </Badge>
                </div>

                {(job.beforePhotoUrl || job.afterPhotoUrl) && (
                  <div className="flex gap-3 mb-3">
                    {job.beforePhotoUrl && (
                      <div className="text-center">
                        <img src={resolveMediaUrl(job.beforePhotoUrl)} alt="Before" className="h-16 w-16 rounded-lg object-cover bg-muted" />
                        <p className="text-[10px] text-muted-foreground mt-0.5">Before</p>
                      </div>
                    )}
                    {job.afterPhotoUrl && (
                      <div className="text-center">
                        <img src={resolveMediaUrl(job.afterPhotoUrl)} alt="After" className="h-16 w-16 rounded-lg object-cover bg-muted" />
                        <p className="text-[10px] text-muted-foreground mt-0.5">After</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  {job.status === "scheduled" && (
                    <Button size="sm" variant="outline" className="text-xs h-7"
                      onClick={() => transitionMutation.mutate({ id: job.id, data: { toStatus: "en_route" } })}>
                      <Route size={12} className="mr-1" /> En Route
                    </Button>
                  )}
                  {job.status === "en_route" && !job.beforePhotoUrl && (
                    <Button size="sm" variant="outline" className="text-xs h-7 relative" disabled={uploadingJobId === job.id}>
                      <Camera size={12} className="mr-1" /> Upload Before
                      <input type="file" accept="image/*" capture="environment" className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(job.id, "beforePhotoUrl", f); e.target.value = ""; }} />
                    </Button>
                  )}
                  {job.status === "en_route" && job.beforePhotoUrl && (
                    <Button size="sm" className="text-xs h-7 bg-primary text-secondary hover:bg-primary/90"
                      onClick={() => transitionMutation.mutate({ id: job.id, data: { toStatus: "in_progress" } })}>
                      <ArrowRight size={12} className="mr-1" /> Start Job
                    </Button>
                  )}
                  {job.status === "in_progress" && !job.afterPhotoUrl && (
                    <Button size="sm" variant="outline" className="text-xs h-7 relative" disabled={uploadingJobId === job.id}>
                      <Camera size={12} className="mr-1" /> Upload After
                      <input type="file" accept="image/*" capture="environment" className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(job.id, "afterPhotoUrl", f); e.target.value = ""; }} />
                    </Button>
                  )}
                  {job.status === "in_progress" && job.afterPhotoUrl && (
                    <Button size="sm" className="text-xs h-7 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => transitionMutation.mutate({ id: job.id, data: { toStatus: "completed" } })}>
                      <CheckCircle size={12} className="mr-1" /> Complete
                    </Button>
                  )}
                  {job.status === "completed" && (
                    <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle size={12} /> Job completed</span>
                  )}
                </div>
              </motion.div>
            ))}
          {!isLoading && displayJobs.length === 0 && (
            <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border border-border">
              {activeTab === "today" ? "No jobs scheduled for today" : activeTab === "upcoming" ? "No upcoming jobs" : "No completed jobs yet"}
            </div>
          )}
        </div>
      </div>
    </StaffLayout>
  );
}
