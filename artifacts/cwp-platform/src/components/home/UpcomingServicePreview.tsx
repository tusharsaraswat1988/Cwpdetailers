import { Link } from "wouter";
import { Calendar, Clock, Car, ArrowRight } from "lucide-react";
import type { Booking } from "@workspace/api-client-react";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";

interface UpcomingServicePreviewProps {
  booking: Booking;
}

export function UpcomingServicePreview({ booking }: UpcomingServicePreviewProps) {
  const serviceName = (booking.serviceName ?? booking.serviceType ?? "Service").replace(/_/g, " ");

  return (
    <div
      className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_2px_8px_rgba(11,29,54,0.04)]"
      data-testid="home-upcoming-service-preview"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Calendar size={13} className="text-primary" />
          Upcoming Service
        </span>
        <Link
          href={CUSTOMER_ROUTES.scheduledServiceDetail(booking.id)}
          className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
        >
          View Details <ArrowRight size={13} />
        </Link>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-display font-bold text-base text-foreground capitalize">
            {serviceName}
          </h4>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              {booking.scheduledDate}
            </span>
            {booking.scheduledTime && (
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {booking.scheduledTime}
              </span>
            )}
            {booking.vehicleInfo && (
              <span className="flex items-center gap-1">
                <Car size={12} />
                {booking.vehicleInfo}
              </span>
            )}
          </div>
        </div>

        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100 capitalize shrink-0">
          {booking.status}
        </span>
      </div>
    </div>
  );
}

export default UpcomingServicePreview;
