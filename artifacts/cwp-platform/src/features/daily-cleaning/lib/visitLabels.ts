export const CUSTOMER_HEADLINE_COMPLETED = "Daily cleaning completed";
export const CUSTOMER_HEADLINE_CAR_NOT_AVAILABLE = "Car was not available for today's cleaning";

export function customerVisitHeadline(status: string, visitType?: string): string {
  if (status === "car_not_available") return CUSTOMER_HEADLINE_CAR_NOT_AVAILABLE;
  if (status === "completed" && visitType === "wash") return "Wash completed";
  if (status === "completed") return CUSTOMER_HEADLINE_COMPLETED;
  return "Visit recorded";
}

export function adminVisitLabel(status: string): string {
  if (status === "car_not_available") return "Car Not Available";
  if (status === "completed") return "Completed";
  if (status === "rejected") return "Rejected";
  if (status === "missed") return "Missed";
  if (status === "pending") return "Pending";
  return status.replace(/_/g, " ");
}

export function staffVisitLabel(status: string): string {
  if (status === "car_not_available") return "Car nahi mili";
  if (status === "completed") return "Done";
  if (status === "missed") return "Missed";
  if (status === "rejected") return "Rejected";
  if (status === "pending") return "Pending";
  return status;
}
