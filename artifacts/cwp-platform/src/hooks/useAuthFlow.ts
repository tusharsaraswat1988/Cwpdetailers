import { useCallback, useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useGoogleAuth } from "@workspace/api-client-react";
import type { AuthResponse } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { getAuthErrorMessage } from "@/lib/authErrorMessages";
import type { AuthPortal } from "@/lib/authFlowStore";

type GooglePhoneLink = {
  linkToken: string;
  email: string;
  name?: string | null;
};

const PORTAL_REDIRECTS: Record<AuthPortal, string> = {
  customer: "/customer/dashboard",
  staff: "/staff/dashboard",
  admin: "/admin/dashboard",
  franchisee: "/franchisee/dashboard",
};

const PORTAL_ALLOWED_ROLES: Record<AuthPortal, string[]> = {
  customer: ["customer"],
  staff: ["staff"],
  admin: ["admin", "superadmin", "manager"],
  franchisee: ["franchisee"],
};

export function useAuthFlow(portal: AuthPortal = "customer") {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const [googlePending, setGooglePending] = useState(false);
  const [phoneLink, setPhoneLink] = useState<GooglePhoneLink | null>(null);
  /** Persists the last Google/portal sign-in failure beyond the toast's lifetime. */
  const [authError, setAuthError] = useState<string | null>(null);
  const clearAuthError = useCallback(() => setAuthError(null), []);

  const redirectAfterAuth = useCallback(
    (role: AuthResponse["user"]["role"]) => {
      if (role === "staff") setLocation("/staff/dashboard");
      else if (["admin", "superadmin", "manager"].includes(role)) setLocation("/admin/dashboard");
      else if (role === "franchisee") setLocation("/franchisee/dashboard");
      else setLocation(PORTAL_REDIRECTS[portal]);
    },
    [portal, setLocation],
  );

  const completeAuth = useCallback(
    (data: AuthResponse) => {
      login(data.user, data.token);
      redirectAfterAuth(data.user.role);
    },
    [login, redirectAfterAuth],
  );

  const handleAuthSuccess = useCallback(
    (data: AuthResponse) => {
      const allowed = PORTAL_ALLOWED_ROLES[portal];
      if (!allowed.includes(data.user.role)) {
        const message = "This sign-in method is not available for your account type.";
        setAuthError(message);
        toast({ title: "Access denied", description: message, variant: "destructive" });
        return;
      }
      setAuthError(null);
      completeAuth(data);
    },
    [completeAuth, portal, toast],
  );

  const handleAuthSuccessRef = useRef(handleAuthSuccess);
  useEffect(() => {
    handleAuthSuccessRef.current = handleAuthSuccess;
  }, [handleAuthSuccess]);

  const googleMutation = useGoogleAuth({
    mutation: {
      onSuccess: (data) => {
        setGooglePending(false);
        if ("needsPhone" in data && data.needsPhone) {
          setPhoneLink({
            linkToken: data.linkToken,
            email: data.email,
            name: data.name,
          });
          return;
        }
        // Existing account matched and session issued — sign in immediately.
        handleAuthSuccessRef.current(data as AuthResponse);
      },
      onError: (err: unknown) => {
        setGooglePending(false);
        const message = getAuthErrorMessage(err, "Could not sign in with Google.");
        setAuthError(message);
        toast({ title: "Google sign-in failed", description: message, variant: "destructive" });
      },
    },
  });

  const handleGoogleToken = useCallback(
    (idToken: string) => {
      setAuthError(null);
      setGooglePending(true);
      googleMutation.mutate({ data: { idToken, portal } });
    },
    [googleMutation, portal],
  );

  const clearPhoneLink = useCallback(() => setPhoneLink(null), []);

  return {
    googlePending,
    phoneLink,
    clearPhoneLink,
    handleGoogleToken,
    handleAuthSuccess,
    googleDisabled: googlePending || googleMutation.isPending,
    authError,
    clearAuthError,
  };
}

/** @deprecated Use useAuthFlow("customer") */
export function useCustomerAuth() {
  return useAuthFlow("customer");
}
