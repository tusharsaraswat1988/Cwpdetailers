import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CustomerButton } from "@/features/customer-ds";
import { Loader2 } from "lucide-react";
import {
  useApproveExtraService,
  useCustomerExtraServicePending,
  useRejectExtraService,
  type ExtraServiceRequestView,
} from "../api";
import { extraServiceApproveLabel } from "../lib/labels";
import { useAuth } from "@/lib/auth";

function ApprovalBody({ request }: { request: ExtraServiceRequestView }) {
  return (
    <div className="space-y-2 text-sm">
      <p>
        <span className="font-semibold">{request.staffName}</span> has requested:
      </p>
      <p className="font-medium">{request.vehicleLabel}</p>
      <p>{request.serviceName}</p>
      {request.addonNames.length > 0 && (
        <p className="text-muted-foreground">{request.addonNames.join(", ")}</p>
      )}
      {request.entitlementLabel && (
        <p className="text-muted-foreground">{request.entitlementLabel}</p>
      )}
      <p className="text-2xl font-bold tabular-nums pt-1">{request.amountDisplay}</p>
    </div>
  );
}

export function CustomerExtraServiceApprovalHost() {
  const { user } = useAuth();
  const enabled = user?.role === "customer";
  const { data } = useCustomerExtraServicePending(enabled);
  const approve = useApproveExtraService();
  const reject = useRejectExtraService();
  const [confirmedId, setConfirmedId] = useState<number | null>(null);

  const requests = data?.requests ?? [];
  const pending = requests.find((r: ExtraServiceRequestView) => r.status === "pending_customer_approval");
  const approved = requests.find((r: ExtraServiceRequestView) => r.status === "customer_approved");
  const showing = pending ?? (approved && approved.id === confirmedId ? approved : approved);

  if (!enabled || !showing) return null;

  const isOtp = showing.status === "customer_approved" && Boolean(showing.otp) && !showing.otpExpired;
  const isExpired = showing.status === "customer_approved" && showing.otpExpired;

  return (
    <Dialog open>
      <DialogContent
        className="max-w-sm"
        data-testid="customer-extra-service-dialog"
        onPointerDownOutside={e => e.preventDefault()}
        onEscapeKeyDown={e => e.preventDefault()}
      >
        {isOtp ? (
          <>
            <DialogHeader>
              <DialogTitle>Tell this verification code to {showing.staffName}</DialogTitle>
              <DialogDescription>This code is only for this extra wash request.</DialogDescription>
            </DialogHeader>
            <p
              className="text-center text-5xl font-bold tracking-[0.35em] tabular-nums py-4"
              data-testid="customer-extra-service-otp"
            >
              {showing.otp}
            </p>
            <p className="text-center text-sm text-muted-foreground">
              {showing.vehicleLabel} · {showing.serviceName} · {showing.amountDisplay}
            </p>
            <p className="text-center text-xs text-muted-foreground">
              Approved. The wash starts only after {showing.staffName} enters this code.
            </p>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Extra service requested</DialogTitle>
              <DialogDescription>
                {isExpired
                  ? "The previous code expired. Approve again to generate a new code."
                  : "This does not open the booking wizard. Approve or reject this exact request."}
              </DialogDescription>
            </DialogHeader>
            <ApprovalBody request={showing} />
            <DialogFooter className="gap-2 sm:gap-2">
              <CustomerButton
                variant="outline"
                disabled={reject.isPending || approve.isPending}
                onClick={() => reject.mutate(showing.id)}
                data-testid="customer-extra-service-reject"
              >
                {reject.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reject"}
              </CustomerButton>
              <CustomerButton
                disabled={reject.isPending || approve.isPending}
                onClick={() => {
                  approve.mutate(showing.id, {
                    onSuccess: (res: { request: ExtraServiceRequestView }) => setConfirmedId(res.request.id),
                  });
                }}
                data-testid="customer-extra-service-approve"
              >
                {approve.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : extraServiceApproveLabel(showing.amount, showing.commercialSource)}
              </CustomerButton>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
