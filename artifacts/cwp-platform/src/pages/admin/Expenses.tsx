import { Redirect } from "wouter";

/** Redirect legacy Expenses route into billing hub tab */
export default function AdminExpenses() {
  return <Redirect to="/admin/billing?tab=expenses" />;
}
