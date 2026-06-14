import FranchiseeLayout from "@/components/layout/FranchiseeLayout";
import CustomersPage from "@/features/customers/pages/Customers";

export default function FranchiseeCustomers() {
  return <CustomersPage Layout={FranchiseeLayout} basePath="/franchisee/customers" />;
}
