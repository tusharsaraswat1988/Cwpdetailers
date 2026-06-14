import AdminLayout from "@/components/layout/AdminLayout";
import { DcmsAdminNav } from "../components/DcmsAdminNav";
import { DcmsPlansPanel } from "@/features/products/components/DcmsPlansPanel";

export default function DcmsPlansPage() {
  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
        <DcmsAdminNav />
        <DcmsPlansPanel />
      </div>
    </AdminLayout>
  );
}
