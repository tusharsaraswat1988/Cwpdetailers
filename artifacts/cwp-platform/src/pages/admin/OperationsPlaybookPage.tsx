import React from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { AdminIntelligencePlaybook } from "@/components/admin/intelligence";

export default function OperationsPlaybookPage() {
  return (
    <AdminLayout>
      <div className="h-[calc(100vh-65px)] min-h-[500px] flex flex-col overflow-hidden" data-testid="operations-playbook-page">
        <AdminIntelligencePlaybook />
      </div>
    </AdminLayout>
  );
}
