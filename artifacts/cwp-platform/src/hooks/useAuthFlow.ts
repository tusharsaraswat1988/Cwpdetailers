import { useCallback, useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useGoogleAuth } from "@workspace/api-client-react";
import type { AuthResponse } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import {
  getActionableAuthDetails,
  type ActionableAuthError,
} from "@/lib/authErrorMessages";
import {
  useAuthStateMachine,
  type AuthUiState,
} from "@/lib/authStateMachine";
import type { AuthPortal } from "@/lib/authFlowStore";

export type GooglePhoneLink = {
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

/**
 * Validates that a redirect path is local and safe against open-redirect attacks.
 * Reject protocol-relative URLs (`//evil.com`), external protocols (`https:`),
 * and backslashes (`\`).
 */
export function sanitizeReturnDestination(path?: string | null): string | null {
  if (!path) return null;
  const trimmed = path.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes(":") ||
    trimmed.includes("\\")
  ) {
    return null;
  }
  return trimmed;
}

export function useAuthFlow(portal: AuthPortal = "customer") {
  const [location, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const [googlePending, setGooglePending] = useState(false);
  const [phoneLink, setPhoneLink] = useState<GooglePhoneLink | null>(null);

  const stateMachine = useAuthStateMachine("idle");
  const [actionableDetails, setActionableDetails] = useState<ActionableAuthError | null>(null);

  /** Extract safe returnTo query param if present */
  const queryParams = new URLSearchParams(location.split("?")[1] ?? "");
  const returnTo = sanitizeReturnDestination(queryParams.get("returnTo") ?? queryParams.get("next"));

  const redirectAfterAuth = useCallback(
    (role: AuthResponse["user"]["role"]) => {
      if (returnTo) {
        setLocation(returnTo);
        return;
      }
      if (role === "staff") setLocation("/staff/dashboard");
      else if (["admin", "superadmin", "manager"].includes(role)) setLocation("/admin/dashboard");
      else if (role === "franchisee") setLocation("/franchisee/dashboard");
      else setLocation(PORTAL_REDIRECTS[portal]);
    },
    [portal, returnTo, setLocation],
  );

  const completeAuth = useCallback(
    (data: AuthResponse) => {
      stateMachine.setAuthenticated();
      login(data.user, data.token, portal);
      redirectAfterAuth(data.user.role);
    },
    [login, portal, redirectAfterAuth, stateMachine],
  );

  const handleAuthSuccess = useCallback(
    (data: AuthResponse) => {
      const allowed = PORTAL_ALLOWED_ROLES[portal];
      if (!allowed.includes(data.user.role)) {
        const details = getActionableAuthDetails(
          new Error("This account uses a different login portal. Try customer or staff login."),
        );
        setActionableDetails(details);
        stateMachine.failWithError(new Error(details.message));
        return;
      }
      setActionableDetails(null);
      completeAuth(data);
    },
    [completeAuth, portal, stateMachine],
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
        handleAuthSuccessRef.current(data as AuthResponse);
      },
      onError: (err: unknown) => {
        setGooglePending(false);
        const details = getActionableAuthDetails(err, "Could not sign in with Google.");
        setActionableDetails(details);
        stateMachine.failWithError(err, "Could not sign in with Google.");
      },
    },
  });

  const handleGoogleToken = useCallback(
    (idToken: string) => {
      if (googlePending || googleMutation.isPending) return; // Prevent double-trigger
      setActionableDetails(null);
      stateMachine.clearError();
      setGooglePending(true);
      stateMachine.startSubmitting();
      googleMutation.mutate({ data: { idToken, portal } });
    },
    [googleMutation, googlePending, portal, stateMachine],
  );

  const clearAuthError = useCallback(() => {
    setActionableDetails(null);
    stateMachine.clearError();
  }, [stateMachine]);

  const clearPhoneLink = useCallback(() => setPhoneLink(null), []);

  const authError = stateMachine.error?.message ?? actionableDetails?.message ?? null;

  return {
    state: stateMachine.state as AuthUiState,
    stateMachine,
    googlePending,
    phoneLink,
    clearPhoneLink,
    handleGoogleToken,
    handleAuthSuccess,
    googleDisabled: googlePending || googleMutation.isPending,
    authError,
    actionableDetails,
    clearAuthError,
  };
}

/** @deprecated Use useAuthFlow("customer") */
export function useCustomerAuth() {
  return useAuthFlow("customer");
}
