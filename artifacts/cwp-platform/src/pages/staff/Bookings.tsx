import { useSearch } from "wouter";
import { StaffOtherServicesPanel } from "@/components/staff/StaffOtherServicesPanel";

export default function StaffBookingsPage() {
  const jobParam = new URLSearchParams(useSearch()).get("job");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display font-bold text-xl">My Bookings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Assigned jobs — kholo aur kaam complete karo</p>
      </div>
      <StaffOtherServicesPanel
        selectedJobKey={jobParam}
        onSelectJob={key => {
          const path = key ? `/staff/bookings?job=${encodeURIComponent(key)}` : "/staff/bookings";
          window.history.replaceState(null, "", path);
          window.dispatchEvent(new PopStateEvent("popstate"));
        }}
      />
    </div>
  );
}
