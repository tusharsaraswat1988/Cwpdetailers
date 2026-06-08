// Real implementation now lives here; legacy `@/pages/admin/Customers` and
// `@/pages/customer/*` re-export from the page files for backward compat.
export { default as AdminCustomers } from "./Customers";
export { default as CustomerDashboard } from "@/pages/customer/Dashboard";
export { default as CustomerHistory } from "@/pages/customer/History";
