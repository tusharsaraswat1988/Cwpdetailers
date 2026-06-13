import { ReactNode } from "react";
import StaffAppShell from "@/components/layout/StaffAppShell";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  scopeLoading: boolean;
  missingStaffLink: boolean;
  staffId: number | null | undefined;
  children: ReactNode;
}

export function StaffAccountGate({ scopeLoading, missingStaffLink, staffId, children }: Props) {
  if (scopeLoading) {
    return (
      <StaffAppShell>
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </StaffAppShell>
    );
  }

  if (missingStaffLink || staffId == null) {
    return (
      <StaffAppShell>
        <div className="max-w-md mx-auto text-center space-y-2 py-16 px-4">
          <p className="font-semibold text-lg">Account not linked</p>
          <p className="text-sm text-muted-foreground">
            Your login is not linked to a staff profile. Ask your admin to create your staff account.
          </p>
        </div>
      </StaffAppShell>
    );
  }

  return <>{children}</>;
}
