import { Redirect, useParams } from "wouter";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";

export function RedirectToPlans() {
  return <Redirect to={CUSTOMER_ROUTES.plans} />;
}

export function RedirectToSchedule() {
  return <Redirect to={CUSTOMER_ROUTES.schedule} />;
}

export function RedirectBookingsIdToSchedule() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? "";
  return <Redirect to={CUSTOMER_ROUTES.scheduledServiceDetail(id)} />;
}
