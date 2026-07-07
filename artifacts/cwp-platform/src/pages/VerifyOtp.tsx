import { useEffect } from "react";
import { useLocation, Redirect } from "wouter";
import { useAuthFlowStore } from "@/lib/authFlowStore";

/** Internal route — redirects to login/register; OTP overlay opens via in-memory store. */
export default function VerifyOtp() {
  const [, setLocation] = useLocation();
  const otpSession = useAuthFlowStore(s => s.otpSession);

  useEffect(() => {
    if (otpSession) {
      setLocation(otpSession.purpose === "signup" ? "/register" : "/login");
    }
  }, [otpSession, setLocation]);

  if (otpSession) return null;
  return <Redirect to="/login" />;
}
