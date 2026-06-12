import { ReactNode } from "react";
import PanelShell from "./PanelShell";
import AdminSidebar from "./AdminSidebar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <PanelShell
      testId="admin-layout"
      mobileTitle="CWP Admin"
      sidebar={(props) => <AdminSidebar {...props} />}
    >
      {children}
    </PanelShell>
  );
}
