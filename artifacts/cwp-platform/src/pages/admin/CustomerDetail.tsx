import AdminLayout from "@/components/layout/AdminLayout";
import CustomerDetailPage from "@/features/customers/pages/CustomerDetail";

export default function AdminCustomerDetail() {
  return (
    <CustomerDetailPage
      Layout={AdminLayout}
      basePath="/admin/customers"
      routePattern="/admin/customers/:id"
    />
  );
}
