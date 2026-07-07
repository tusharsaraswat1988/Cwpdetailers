import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AuthLayoutProps = {
  children: ReactNode;
  testId?: string;
  className?: string;
};

export function AuthLayout({ children, testId, className }: AuthLayoutProps) {
  return (
    <div
      className={cn(
        "min-h-[100dvh] bg-secondary flex items-center justify-center px-4 py-5 sm:px-6 sm:py-6",
        className,
      )}
      data-testid={testId}
    >
      <div className="w-full max-w-[22rem] sm:max-w-md">{children}</div>
    </div>
  );
}
