import { useMemo, useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import {
  useGetBooking, getGetBookingQueryKey,
  useGetBookingEvents, getGetBookingEventsQueryKey,
  getListBookingsQueryKey,
  useRescheduleBooking,
} from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ErrorState } from "@/components/shared/ErrorState";
import { resolveMediaUrl } from "@/lib/media-url";
import { mapsViewUrl } from "@/lib/maps";
import { useToast } from "@/hooks/use-toast";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";
import { moduleError } from "@/lib/moduleErrors";
import {
  ArrowLeft, Calendar, Clock, MapPin, User, Star, ExternalLink,
  CheckCircle2, XCircle, CalendarClock, Image as ImageIcon, Loader2,
  Car, MessageCircle,
} from "lucide-react";

const CANCELLABLE_STATUSES = new Set(["draft", "confirmed", "scheduled", "waiting_assignment", "rescheduled"]);

function StatusStep({
  label, done, active, isLast,
}: { label: string; done: boolean; active: boolean; isLast: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 ${
            done || active
              ? "bg-primary border-primary text-secondary"
              : "bg-muted border-border text-muted-foreground"
          }`}
        >
          {done ? <CheckCircle2 size={13} /> : <span className="w-1.5 h-1.5 rounded-full bg-current" />}
        </div>
        {!isLast && <div className={`w-px flex-1 min-h-[20px] ${done ? "bg-primary" : "bg-border"}`} />}
      </div>
      <p className={`text-sm pb-5 ${done || active ? "font-medium text-foreground" : "text-muted-foreground"}`}>
        {label}
      </p>
    </div>
  );
}

export default function BookingDetail() {
  const params = useParams<{ id: string }>();
  const bookingId = parseInt(params.id ?? "", 10);
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const { data: booking, isLoading, isError, refetch } = useGetBooking(bookingId, {
    query: { queryKey: getGetBookingQueryKey(bookingId), enabled: Number.isFinite(bookingId) },
  });

  const { data: events } = useGetBookingEvents(bookingId, {
    query: { queryKey: getGetBookingEventsQueryKey(bookingId), enabled: Number.isFinite(bookingId) },
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: getGetBookingQueryKey(bookingId) });
    qc.invalidateQueries({ queryKey: getGetBookingEventsQueryKey(bookingId) });
    qc.invalidateQueries({ queryKey: getListBookingsQueryKey() });
  };

  const cancelMutation = useMutation({
    mutationFn: async (reason: string) => {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? moduleError("bookings", "save"));
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
      setCancelOpen(false);
      toast({ title: "Scheduled service cancelled" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const rescheduleMutation = useRescheduleBooking({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        setRescheduleOpen(false);
        toast({ title: "Scheduled service rescheduled" });
      },
      onError: (err: { response?: { data?: { error?: string } } }) =>
        toast({ title: err?.response?.data?.error ?? moduleError("bookings", "save"), variant: "destructive" }),
    },
  });

  const photos = useMemo(() => {
    if (!booking) return [] as { url: string; label: string }[];
    const list: { url: string; label: string }[] = [];
    if (booking.beforePhotoUrl) list.push({ url: booking.beforePhotoUrl, label: "Before" });
    if (booking.afterPhotoUrl) list.push({ url: booking.afterPhotoUrl, label: "After" });
    (booking.proofPhotoUrls ?? []).forEach((u: string, i: number) => list.push({ url: u, label: `Proof ${i + 1}` }));
    return list;
  }, [booking]);

  const canCancel = booking ? CANCELLABLE_STATUSES.has(booking.status) : false;
  const canReschedule = canCancel;

  const today = new Date().toISOString().split("T")[0];

  if (!Number.isFinite(bookingId)) {
    return (
      <CustomerLayout>
        <ErrorState title="Invalid link" description="This scheduled service link looks incorrect." />
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="max-w-lg mx-auto space-y-5 pb-8">
        <button
          onClick={() => navigate(CUSTOMER_ROUTES.serviceHistory)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          data-testid="btn-back-to-history"
        >
          <ArrowLeft size={14} /> Back to history
        </button>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        ) : isError || !booking ? (
          <ErrorState
            title="Couldn't load this scheduled service"
            description="It may have been removed, or you don't have access to it."
            onRetry={() => refetch()}
          />
        ) : (
          <>
            <div>
              <div className="flex items-center justify-between gap-3">
                <h1 className="font-display font-bold text-2xl capitalize leading-tight">
                  {(booking.serviceName ?? booking.serviceType.replace(/_/g, " "))}
                </h1>
                <StatusBadge
                  status={booking.status}
                  pulse={booking.status === "confirmed" || booking.status === "waiting_assignment"}
                />
              </div>
              <p className="text-muted-foreground text-sm mt-1">Request #{booking.id}</p>
            </div>

            <Card>
              <CardContent className="p-4 space-y-3 text-sm">
                <h2 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Current status</h2>
                <div className="flex items-center justify-between">
                  <StatusBadge
                    status={booking.status}
                    pulse={booking.status === "confirmed" || booking.status === "waiting_assignment"}
                  />
                  {booking.status === "draft" && (
                    <span className="text-xs text-muted-foreground">Awaiting CWP confirmation</span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <h2 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Service details</h2>
                {booking.vehicleInfo && (
                  <div className="flex items-center gap-3 text-sm">
                    <Car size={15} className="text-primary shrink-0" />
                    <span>{booking.vehicleInfo}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <Calendar size={15} className="text-primary shrink-0" />
                  <span>{booking.scheduledDate}</span>
                  {booking.scheduledTime && (
                    <>
                      <Clock size={14} className="text-muted-foreground shrink-0 ml-1" />
                      <span>{booking.scheduledTime}</span>
                    </>
                  )}
                </div>
                {booking.address && (
                  <div className="flex items-start gap-3 text-sm">
                    <MapPin size={15} className="text-primary shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p>{booking.address}</p>
                      {booking.locationLat != null && booking.locationLng != null && (
                        <a
                          href={mapsViewUrl(booking.locationLat, booking.locationLng)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5"
                        >
                          <ExternalLink size={10} /> View on map
                        </a>
                      )}
                    </div>
                  </div>
                )}
                {booking.staffName && (
                  <div className="flex items-center gap-3 text-sm">
                    <User size={15} className="text-primary shrink-0" />
                    <span>{booking.staffName}</span>
                  </div>
                )}
                {booking.amount != null && (
                  <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-semibold">₹{Number(booking.amount).toLocaleString("en-IN")}</span>
                  </div>
                )}
                {booking.rating != null && (
                  <div className="flex items-center gap-1 pt-1">
                    {Array.from({ length: booking.rating }).map((_, i) => (
                      <Star key={i} size={13} fill="currentColor" className="text-primary" />
                    ))}
                  </div>
                )}
                {booking.notes && (
                  <div className="text-sm pt-2 border-t border-border">
                    <p className="text-muted-foreground text-xs mb-0.5">Your notes</p>
                    <p>{booking.notes}</p>
                  </div>
                )}
                {booking.cancellationReason && (
                  <div className="text-sm pt-2 border-t border-border">
                    <p className="text-muted-foreground text-xs mb-0.5">Cancellation reason</p>
                    <p>{booking.cancellationReason}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Photos */}
            {photos.length > 0 && (
              <div>
                <h2 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                  <ImageIcon size={14} className="text-primary" /> Service photos
                </h2>
                <div className="flex flex-wrap gap-2">
                  {photos.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => setLightboxUrl(resolveMediaUrl(p.url))}
                      className="text-center group"
                      data-testid={`booking-photo-${i}`}
                    >
                      <img
                        src={resolveMediaUrl(p.url)}
                        alt={p.label}
                        className="w-20 h-20 rounded-lg object-cover border border-border group-hover:opacity-80 transition-opacity cursor-pointer"
                      />
                      <p className="text-[9px] text-muted-foreground mt-0.5">{p.label}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline */}
            {(events ?? []).length > 0 && (
              <div>
                <h2 className="font-semibold text-sm mb-2">Timeline</h2>
                <Card>
                  <CardContent className="p-4">
                    {[...(events ?? [])].reverse().map((ev, i, arr) => (
                      <StatusStep
                        key={ev.id}
                        label={
                          ev.body ??
                          (ev.toStatus ? `Status changed to ${ev.toStatus.replace(/_/g, " ")}` : ev.type.replace(/_/g, " "))
                        }
                        done
                        active={i === arr.length - 1}
                        isLast={i === arr.length - 1}
                      />
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Actions — placeholders for future self-serve */}
            {(canCancel || canReschedule) && (
              <div className="space-y-2 pt-2">
                <p className="text-xs text-muted-foreground text-center">Need to change this visit? Contact CWP or use the options below.</p>
                <div className="flex gap-2">
                  {canReschedule && (
                    <Button
                      variant="outline"
                      className="flex-1 h-11 gap-1.5"
                      onClick={() => {
                        setNewDate(booking.scheduledDate);
                        setNewTime(booking.scheduledTime ?? "09:00");
                        setRescheduleOpen(true);
                      }}
                      data-testid="btn-open-reschedule"
                    >
                      <CalendarClock size={15} /> Reschedule
                    </Button>
                  )}
                  {canCancel && (
                    <Button
                      variant="outline"
                      className="flex-1 h-11 gap-1.5 text-destructive hover:text-destructive"
                      onClick={() => setCancelOpen(true)}
                      data-testid="btn-open-cancel"
                    >
                      <XCircle size={15} /> Cancel
                    </Button>
                  )}
                </div>
              </div>
            )}

            <Link href={CUSTOMER_ROUTES.support} className="block">
              <Button variant="ghost" className="w-full h-11 gap-2" data-testid="scheduled-service-support">
                <MessageCircle size={16} /> Support
              </Button>
            </Link>

            {!canCancel && !canReschedule && booking.status !== "completed" && booking.status !== "cancelled" && (
              <p className="text-xs text-muted-foreground text-center">
                This scheduled service is already in progress and can no longer be changed here.
              </p>
            )}
          </>
        )}
      </div>

      {/* Cancel dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this scheduled service?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="Let us know why, so we can improve"
              data-testid="input-cancel-reason"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Keep service</Button>
            <Button
              variant="destructive"
              disabled={cancelMutation.isPending}
              data-testid="btn-confirm-cancel"
              onClick={() => cancelMutation.mutate(cancelReason)}
            >
              {cancelMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1.5" /> : null}
              Yes, cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule dialog */}
      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule service</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>New date</Label>
              <Input
                type="date"
                min={today}
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                className="mt-1"
                data-testid="input-reschedule-date"
              />
            </div>
            <div>
              <Label>Time</Label>
              <Input
                type="time"
                value={newTime}
                onChange={e => setNewTime(e.target.value)}
                className="mt-1"
                data-testid="input-reschedule-time"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRescheduleOpen(false)}>Cancel</Button>
            <Button
              disabled={!newDate || rescheduleMutation.isPending}
              data-testid="btn-confirm-reschedule"
              onClick={() => rescheduleMutation.mutate({
                id: bookingId,
                data: { scheduledDate: newDate, scheduledTime: newTime || undefined },
              })}
            >
              {rescheduleMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1.5" /> : null}
              Confirm new time
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo lightbox */}
      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="max-w-2xl p-2 bg-black border-0">
          {lightboxUrl && (
            <img src={lightboxUrl} alt="Service photo" className="w-full h-auto rounded-lg max-h-[80vh] object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </CustomerLayout>
  );
}
