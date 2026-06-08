import { useAuth } from "@/lib/auth";
import { useGetTodayBookings, getGetTodayBookingsQueryKey, useUpdateBooking, getListBookingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import StaffLayout from "@/components/layout/StaffLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Calendar, CheckCircle, Clock, MapPin } from "lucide-react";
import { motion } from "framer-motion";

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  confirmed: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  in_progress: "bg-primary/10 text-primary border-primary/20",
  completed: "bg-green-500/10 text-green-600 border-green-500/20",
};

export default function StaffDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const staffId = 1; // derive from user in real app

  const { data: todayJobs, isLoading } = useGetTodayBookings({ staffId }, {
    query: { queryKey: getGetTodayBookingsQueryKey({ staffId }) }
  });

  const updateMutation = useUpdateBooking({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetTodayBookingsQueryKey() });
        qc.invalidateQueries({ queryKey: getListBookingsQueryKey() });
        toast({ title: "Job status updated" });
      },
    },
  });

  const completed = (todayJobs ?? []).filter(j => j.status === "completed").length;
  const pending = (todayJobs ?? []).filter(j => j.status !== "completed" && j.status !== "cancelled").length;

  return (
    <StaffLayout>
      <div className="p-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display font-bold text-2xl">Good morning, {user?.name?.split(" ")[0]}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Today's Jobs", value: (todayJobs ?? []).length, icon: Calendar },
            { label: "Completed", value: completed, icon: CheckCircle },
            { label: "Remaining", value: pending, icon: Clock },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
              <div className="bg-card border border-border rounded-xl p-4 text-center" data-testid={`staff-stat-${s.label.toLowerCase().replace(/\s+/g, "-")}`}>
                <s.icon size={18} className="text-primary mx-auto mb-2" />
                {isLoading ? <Skeleton className="h-6 w-8 mx-auto" /> : <p className="font-display font-bold text-2xl text-primary">{s.value}</p>}
                <p className="text-muted-foreground text-xs mt-0.5">{s.label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Today's jobs */}
        <div>
          <h2 className="font-semibold text-base mb-3">Today's Schedule</h2>
          <div className="space-y-3">
            {isLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />) :
              (todayJobs ?? []).map((job, i) => (
                <motion.div key={job.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className="bg-card border border-border rounded-xl p-4" data-testid={`job-card-${job.id}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="font-semibold text-sm">{job.customerName}</p>
                      <p className="text-xs text-muted-foreground capitalize">{job.serviceType?.replace(/_/g, " ")} · {job.scheduledTime}</p>
                      {job.address && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <MapPin size={10} />
                          <span>{job.address}</span>
                        </div>
                      )}
                    </div>
                    <Badge variant="outline" className={`text-xs capitalize flex-shrink-0 ${statusColors[job.status ?? "pending"]}`}>
                      {job.status?.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    {job.status === "confirmed" && (
                      <Button size="sm" variant="outline" className="text-xs h-7"
                        data-testid={`btn-start-job-${job.id}`}
                        onClick={() => updateMutation.mutate({ id: job.id, data: { status: "in_progress" } })}>
                        Start Job
                      </Button>
                    )}
                    {job.status === "in_progress" && (
                      <Button size="sm" className="text-xs h-7 bg-green-600 hover:bg-green-700 text-white"
                        data-testid={`btn-complete-job-${job.id}`}
                        onClick={() => updateMutation.mutate({ id: job.id, data: { status: "completed" } })}>
                        Mark Complete
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))}
            {!isLoading && (todayJobs ?? []).length === 0 && (
              <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border border-border">
                No jobs scheduled for today
              </div>
            )}
          </div>
        </div>
      </div>
    </StaffLayout>
  );
}
