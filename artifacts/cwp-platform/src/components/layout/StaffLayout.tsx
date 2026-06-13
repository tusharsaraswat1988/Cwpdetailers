import { ReactNode } from "react";
import StaffAppShell from "./StaffAppShell";

/** @deprecated Use StaffAppShell — kept for gradual migration; now wraps mobile-first shell only */
export default function StaffLayout({ children }: { children: ReactNode }) {
  return <StaffAppShell>{children}</StaffAppShell>;
}
