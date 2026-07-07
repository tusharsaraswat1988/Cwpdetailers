import { useCallback, useState } from "react";
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
  const [pendingGoogleAuth, setPendingGoogleAuth] = useState<AuthResponse | null>(null);

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
        toast({
          title: "Access denied",
          description: "This sign-in method is not available for your account type.",
          variant: "destructive",
        });
        return;
      }
      completeAuth(data);
    },
    [completeAuth, portal, toast],
  );

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
        setPendingGoogleAuth(data as AuthResponse);
      },
      onError: (err: unknown) => {
        setGooglePending(false);
        toast({
          title: "Google sign-in failed",
          description: getAuthErrorMessage(err, "Could not sign in with Google."),
          variant: "destructive",
        });
      },
    },
  });

  const handleGoogleToken = useCallback(
    (idToken: string) => {
      setGooglePending(true);
      googleMutation.mutate({ data: { idToken, portal } });
    },
    [googleMutation, portal],
  );

  const confirmGoogleAuth = useCallback(() => {
    if (!pendingGoogleAuth) return;
    const data = pendingGoogleAuth;
    setPendingGoogleAuth(null);
    handleAuthSuccess(data);
  }, [handleAuthSuccess, pendingGoogleAuth]);

  const declineGoogleAuth = useCallback(() => {
    setPendingGoogleAuth(null);
  }, []);

  const clearPhoneLink = useCallback(() => setPhoneLink(null), []);

  return {
    googlePending,
    phoneLink,
    pendingGoogleAuth,
    clearPhoneLink,
    handleGoogleToken,
    handleAuthSuccess,
    confirmGoogleAuth,
    declineGoogleAuth,
    googleDisabled: googlePending || googleMutation.isPending,
  };
}

/** @deprecated Use useAuthFlow("customer") */
export function useCustomerAuth() {
  return useAuthFlow("customer");
}
