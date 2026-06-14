import AdminLayout from "@/components/layout/AdminLayout";
import CustomersPage from "@/features/customers/pages/Customers";

export default function AdminCustomers() {
  return <CustomersPage Layout={AdminLayout} basePath="/admin/customers" />;
}
