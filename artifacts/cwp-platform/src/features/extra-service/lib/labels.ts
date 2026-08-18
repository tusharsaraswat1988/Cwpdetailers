export type ExtraServiceStatus =
  | "pending_customer_approval"
  | "customer_approved"
  | "otp_verified"
  | "rejected"
  | "cancelled";

export function extraServiceStaffHeadline(status: ExtraServiceStatus, otpExpired?: boolean): string {
  if (status === "pending_customer_approval") return "Waiting for customer approval";
  if (status === "customer_approved" && otpExpired) return "Code expired — ask customer to approve again";
  if (status === "customer_approved") return "Customer approved — enter OTP";
  if (status === "otp_verified") return "Service added";
  if (status === "rejected") return "Customer rejected";
  return "Request cancelled";
}

export function extraServiceApproveLabel(amount: number, source: "DCC_INCLUDED" | "PAID_EXTRA"): string {
  if (source === "DCC_INCLUDED" && amount <= 0) return "Approve included wash";
  return `Approve ₹${Math.round(amount)}`;
}

export function extraServiceConsumptionOn(event: "otp_verify" | "completion"): "none" | "entitlement" {
  return event === "completion" ? "entitlement" : "none";
}
