import { Redirect } from "wouter";

/** Redirect legacy Dues route into billing hub tab */
export default function AdminDues() {
  return <Redirect to="/admin/billing?tab=dues" />;
}
