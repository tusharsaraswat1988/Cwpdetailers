import { useState } from "react";
import FranchiseeLayout from "@/components/layout/FranchiseeLayout";
import { useAuth } from "@/lib/auth";
import { useListBookings } from "@workspace/api-client-react";
import type { ListBookingsStatus } from "@workspace/api-client-react";
import { Calendar, Clock, CheckCircle, AlertCircle, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-500",
  confirmed: "bg-blue-500/10 text-blue-400",
  in_progress: "bg-primary/10 text-primary",
  completed: "bg-green-500/10 text-green-500",
  cancelled: "bg-red-500/10 text-red-400",
};

export default function FranchiseeBookings() {
  const { user } = useAuth();
  const branchId = user?.branchId ?? undefined;
  const [statusFilter, setStatusFilter] = useState<ListBookingsStatus | "">("pending");

  const { data, isLoading } = useListBookings({
    branchId,
    status: statusFilter || undefined,
  });
  const bookings = data?.data ?? [];

  const filters = ["all", "pending", "confirmed", "in_progress", "completed", "cancelled"];

  return (
    <FranchiseeLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl">Booking Requests</h1>
            <p className="text-muted-foreground text-sm mt-1">Review and track customer bookings in your city</p>
          </div>
        </div>

        {/* Note: payments handled centrally */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-5 text-sm text-amber-600">
          <strong>Note:</strong> All payments are collected and settled by CWP Admin. Your role is to coordinate job scheduling and staff dispatch.
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap mb-5">
          {filters.map(f => (
            <button key={f}
              onClick={() => setStatusFilter(f === "all" ? "" : (f as ListBookingsStatus))}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize ${
                (f === "all" && !statusFilter) || f === statusFilter
                  ? "bg-primary text-secondary"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}>
              {f === "all" ? "All" : f.replace("_", " ")}
            </button>
          ))}
        </div>

        {/* Bookings list */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="divide-y divide-border">
            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground text-sm">Loading…</div>
            ) : bookings.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">No bookings found</div>
            ) : (
              bookings.map((b: any) => (
                <div key={b.id} className="px-5 py-4 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Calendar size={16} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{b.customerName || `Customer #${b.customerId}`}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[b.status] || "bg-muted text-muted-foreground"}`}>
                        {b.status?.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{b.serviceName || "Service"}</p>
                    <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span>{b.scheduledDate} {b.scheduledTime ? `· ${b.scheduledTime}` : ""}</span>
                      {b.staffName && <span>· Staff: {b.staffName}</span>}
                      {b.amount && <span>· ₹{Number(b.amount).toLocaleString("en-IN")}</span>}
                    </div>
                    {b.notes && <p className="text-xs text-muted-foreground mt-1 italic">{b.notes}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </FranchiseeLayout>
  );
}
