/**
 * P1 Complete Authentication UI State Machine
 *
 * Explicitly manages UI authentication states, protects against race conditions,
 * rejects stale asynchronous responses, and handles server rate limits, provider downtime,
 * and account conflicts.
 */

import { useState, useRef, useCallback } from "react";
import {
  extractApiErrorCode,
  getAuthErrorMessage,
  type StructuredAuthCode,
} from "./authErrorMessages";

export type AuthUiState =
  | "idle"
  | "validating"
  | "submitting"
  | "awaiting_otp"
  | "verifying_otp"
  | "authenticated"
  | "recoverable_error"
  | "rate_limited"
  | "provider_unavailable"
  | "account_conflict"
  | "session_expired";

export interface AuthStateError {
  message: string;
  code?: StructuredAuthCode | null;
  raw?: string;
  actionableStep?: string | null;
}

export function classifyAuthError(
  err: unknown,
  fallbackMessage = "We couldn't complete this request. Please try again.",
): { state: AuthUiState; error: AuthStateError } {
  const code = extractApiErrorCode(err);
  const message = getAuthErrorMessage(err, fallbackMessage);
  const raw = err instanceof Error ? err.message : String(err);

  let state: AuthUiState = "recoverable_error";
  let actionableStep: string | null = null;

  if (code === "OTP_RATE_LIMITED" || /too many attempts|rate limit/i.test(raw)) {
    state = "rate_limited";
    actionableStep = "Please wait a few minutes before requesting another code.";
  } else if (
    code === "OTP_PROVIDER_UNAVAILABLE" ||
    /sms otp is not configured|verification is temporarily unavailable/i.test(raw)
  ) {
    state = "provider_unavailable";
    actionableStep = "SMS service is temporarily unavailable. You can sign in using your password instead.";
  } else if (
    code === "PORTAL_MISMATCH" ||
    code === "ACCOUNT_LINK_CONFLICT" ||
    /different login portal|cannot sign in here|staff portal|admin portal/i.test(raw)
  ) {
    state = "account_conflict";
    actionableStep = /admin/i.test(message)
      ? "Switch to Admin Portal"
      : /staff/i.test(message)
        ? "Switch to Staff Portal"
        : "Check your portal link";
  } else if (/session expired|unauthorized|jwt expired/i.test(raw) || (typeof err === "object" && err !== null && (err as { status?: number }).status === 401)) {
    state = "session_expired";
    actionableStep = "Please sign in again to continue.";
  }

  return {
    state,
    error: {
      message,
      code,
      raw,
      actionableStep,
    },
  };
}

export function useAuthStateMachine(initialState: AuthUiState = "idle") {
  const [state, setState] = useState<AuthUiState>(initialState);
  const [error, setError] = useState<AuthStateError | null>(null);

  // Monotonically increasing request sequence number to reject stale async responses
  const activeRequestIdRef = useRef<number>(0);

  const startValidating = useCallback(() => {
    setState("validating");
    setError(null);
  }, []);

  const startSubmitting = useCallback((): number => {
    activeRequestIdRef.current += 1;
    setState("submitting");
    setError(null);
    return activeRequestIdRef.current;
  }, []);

  const isCurrentRequest = useCallback((reqId: number): boolean => {
    return activeRequestIdRef.current === reqId;
  }, []);

  const setAwaitingOtp = useCallback((reqId?: number) => {
    if (reqId !== undefined && activeRequestIdRef.current !== reqId) return;
    setState("awaiting_otp");
    setError(null);
  }, []);

  const startVerifyingOtp = useCallback((): number => {
    activeRequestIdRef.current += 1;
    setState("verifying_otp");
    setError(null);
    return activeRequestIdRef.current;
  }, []);

  const setAuthenticated = useCallback((reqId?: number) => {
    if (reqId !== undefined && activeRequestIdRef.current !== reqId) return;
    setState("authenticated");
    setError(null);
  }, []);

  const failWithError = useCallback(
    (err: unknown, fallbackMessage?: string, reqId?: number) => {
      if (reqId !== undefined && activeRequestIdRef.current !== reqId) return;
      const { state: nextState, error: classifiedError } = classifyAuthError(err, fallbackMessage);
      setState(nextState);
      setError(classifiedError);
    },
    [],
  );

  const clearError = useCallback(() => {
    setError(null);
    setState(prev =>
      ["recoverable_error", "rate_limited", "provider_unavailable", "account_conflict", "session_expired"].includes(prev)
        ? "idle"
        : prev,
    );
  }, []);

  const reset = useCallback(() => {
    activeRequestIdRef.current += 1;
    setState("idle");
    setError(null);
  }, []);

  const isBusy = state === "validating" || state === "submitting" || state === "verifying_otp";
  const canSubmit = !isBusy && state !== "rate_limited";

  return {
    state,
    error,
    isBusy,
    canSubmit,
    startValidating,
    startSubmitting,
    isCurrentRequest,
    setAwaitingOtp,
    startVerifyingOtp,
    setAuthenticated,
    failWithError,
    clearError,
    reset,
  };
}
