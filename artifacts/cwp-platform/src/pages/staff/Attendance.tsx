import { useState } from "react";
import { useGetStaffAttendance, getGetStaffAttendanceQueryKey, useMarkAttendance } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import StaffLayout from "@/components/layout/StaffLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Calendar, CheckCircle } from "lucide-react";

const statusColors: Record<string, string> = {
  present: "bg-green-500/10 text-green-600 border-green-500/20",
  absent: "bg-destructive/10 text-destructive border-destructive/20",
  late: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  half_day: "bg-blue-500/10 text-blue-600 border-blue-500/20",
};

export default function StaffAttendance() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const staffId = 1;

  const { data: attendance, isLoading } = useGetStaffAttendance(staffId, { month }, {
    query: { queryKey: getGetStaffAttendanceQueryKey(staffId, { month }) }
  });

  const markMutation = useMarkAttendance({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetStaffAttendanceQueryKey(staffId) });
        toast({ title: "Attendance marked" });
      },
    },
  });

  const todayMarked = (attendance ?? []).some(a => a.date === new Date().toISOString().split("T")[0]);
  const presentDays = (attendance ?? []).filter(a => a.status === "present").length;

  return (
    <StaffLayout>
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl">Attendance</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{presentDays} present days this month</p>
          </div>
          <div className="flex items-center gap-3">
            <input type="month" value={month} onChange={e => setMonth(e.target.value)}
              className="border border-border rounded-lg px-3 py-1.5 text-sm bg-card" data-testid="input-month" />
            {!todayMarked && (
              <Button size="sm" className="bg-primary text-secondary hover:bg-primary/90"
                data-testid="btn-mark-present"
                onClick={() => markMutation.mutate({ id: staffId, data: { date: new Date().toISOString().split("T")[0], status: "present", checkInTime: new Date().toTimeString().slice(0, 5) } })}>
                <CheckCircle size={13} className="mr-1.5" />Mark Present
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
          {isLoading ? Array.from({ length: 20 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />) :
            (attendance ?? []).map(a => (
              <div key={a.id} className={`rounded-lg border p-2 text-center ${statusColors[a.status]}`} data-testid={`attendance-${a.date}`}>
                <p className="font-bold text-sm">{a.date?.split("-")[2]}</p>
                <p className="text-xs capitalize mt-0.5">{a.status?.replace(/_/g, " ")}</p>
                {a.checkInTime && <p className="text-xs mt-0.5 opacity-70">{a.checkInTime}</p>}
              </div>
            ))}
        </div>
        {!isLoading && (attendance ?? []).length === 0 && (
          <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border border-border">No attendance records for this month</div>
        )}
      </div>
    </StaffLayout>
  );
}
