import AdminLayout from "@/components/layout/AdminLayout";
import { ServicesTab } from "@/features/service-catalog/components/ServicesTab";

export default function AdminServices() {
  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <ServicesTab />
      </div>
    </AdminLayout>
  );
}
