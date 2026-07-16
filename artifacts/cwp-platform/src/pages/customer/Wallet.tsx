import { Redirect } from "wouter";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";

/** @deprecated Use /customer/plans — kept for backward-compatible deep links. */
export default function CustomerWalletRedirect() {
  return <Redirect to={CUSTOMER_ROUTES.plans} />;
}
