import FranchiseeLayout from "@/components/layout/FranchiseeLayout";
import CustomerDetailPage from "@/features/customers/pages/CustomerDetail";

export default function FranchiseeCustomerDetail() {
  return (
    <CustomerDetailPage
      Layout={FranchiseeLayout}
      basePath="/franchisee/customers"
      routePattern="/franchisee/customers/:id"
    />
  );
}
