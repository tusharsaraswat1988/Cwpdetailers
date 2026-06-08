import { ReactNode } from "react";
import { useAuth } from "@/lib/auth";

interface CanProps {
  resource: string;
  action: string;
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Conditionally render `children` only if the current user has the
 * given permission. Use `fallback` for disabled/locked states.
 *
 * Example:
 *   <Can resource="customers" action="delete">
 *     <Button variant="destructive">Delete</Button>
 *   </Can>
 */
export function Can({ resource, action, fallback = null, children }: CanProps) {
  const { hasPermission } = useAuth();
  if (!hasPermission(resource, action)) return <>{fallback}</>;
  return <>{children}</>;
}

export default Can;
