import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useForgotPassword,
  useResetPassword,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { PasswordInput } from "@/components/ui/password-input";
import { EmailInput } from "@/components/ui/email-input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { submitEmail, submitMobile } from "@/lib/contactForm";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { useBranding } from "@/lib/branding";
import { ArrowLeft, Loader2, Mail, Smartphone } from "lucide-react";

type AuthPortal = "customer" | "staff";
type Step = "request" | "verify" | "done";

type ForgotPasswordPageProps = {
  portal?: AuthPortal;
};

export default function ForgotPasswordPage({ portal: portalProp }: ForgotPasswordPageProps) {
  const branding = useBranding();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();

  const portal: AuthPortal = portalProp
    ?? (location.startsWith("/staff") ? "staff" : "customer");

  const loginPath = portal === "staff" ? "/staff/login" : "/login";
  const title = portal === "staff" ? `${branding.brandName} Staff` : "Reset password";

  const [step, setStep] = useState<Step>("request");
  const [mode, setMode] = useState<"phone" | "email">("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [deliveryInfo, setDeliveryInfo] = useState<{
    sentSms?: boolean;
    sentEmail?: boolean;
    maskedPhone?: string;
    maskedEmail?: string | null;
  }>({});

  const forgotMutation = useForgotPassword({
    mutation: {
      onSuccess: (data) => {
        setDeliveryInfo(data);
        setStep("verify");
        toast({
          title: "Reset code sent",
          description: buildDeliveryMessage(data),
        });
      },
      onError: (err: { response?: { data?: { error?: string } } }) => {
        toast({
          title: "Could not send code",
          description: err?.response?.data?.error ?? "Please try again or contact support.",
          variant: "destructive",
        });
      },
    },
  });

  const resetMutation = useResetPassword({
    mutation: {
      onSuccess: () => {
        setStep("done");
        toast({ title: "Password updated", description: "You can now sign in with your new password." });
      },
      onError: (err: { response?: { data?: { error?: string } } }) => {
        toast({
          title: "Reset failed",
          description: err?.response?.data?.error ?? "Invalid or expired code.",
          variant: "destructive",
        });
      },
    },
  });

  const handleRequest = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "phone") {
      const phoneResult = submitMobile(phone);
      setPhoneError(phoneResult.ok ? null : phoneResult.error);
      if (!phoneResult.ok) {
        toast({ title: phoneResult.error, variant: "destructive" });
        return;
      }
      forgotMutation.mutate({ data: { phone: phoneResult.value, portal } });
    } else {
      const emailResult = submitEmail(email);
      setEmailError(emailResult.ok ? null : emailResult.error);
      if (!emailResult.ok) {
        toast({ title: emailResult.error, variant: "destructive" });
        return;
      }
      forgotMutation.mutate({ data: { email: emailResult.value, portal } });
    }
  };

  const handleReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast({ title: "Enter the 6-digit code", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }

    if (mode === "phone") {
      const phoneResult = submitMobile(phone);
      if (!phoneResult.ok) {
        toast({ title: phoneResult.error, variant: "destructive" });
        return;
      }
      resetMutation.mutate({ data: { phone: phoneResult.value, code: otp, newPassword, portal } });
    } else {
      const emailResult = submitEmail(email);
      if (!emailResult.ok) {
        toast({ title: emailResult.error, variant: "destructive" });
        return;
      }
      resetMutation.mutate({ data: { email: emailResult.value, code: otp, newPassword, portal } });
    }
  };

  return (
    <div className="min-h-[100dvh] bg-secondary flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <BrandLogo variant="login" lazy={false} />
          </div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-white">{title}</h1>
          <p className="text-white/50 mt-1 text-sm">
            {step === "request" && "We'll send an OTP via SMS"}
            {step === "verify" && "Enter the code and choose a new password"}
            {step === "done" && "All set — sign in with your new password"}
          </p>
        </div>

        {step === "request" && (
          <form onSubmit={handleRequest} className="space-y-4">
            <div className="flex rounded-lg border border-white/10 p-0.5 bg-white/5">
              <button
                type="button"
                onClick={() => setMode("phone")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm rounded-md transition-colors ${
                  mode === "phone" ? "bg-primary text-secondary font-medium" : "text-white/50 hover:text-white/70"
                }`}
              >
                <Smartphone size={14} />
                SMS
              </button>
              <button
                type="button"
                onClick={() => setMode("email")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm rounded-md transition-colors ${
                  mode === "email" ? "bg-primary text-secondary font-medium" : "text-white/50 hover:text-white/70"
                }`}
              >
                <Mail size={14} />
                Email
              </button>
            </div>

            {mode === "phone" ? (
              <PhoneInput
                id="forgot-phone"
                label="Registered phone number"
                dark
                value={phone}
                onChange={setPhone}
                error={phoneError}
                onErrorChange={setPhoneError}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary"
              />
            ) : (
              <EmailInput
                id="forgot-email"
                label="Registered email address"
                dark
                value={email}
                onChange={setEmail}
                error={emailError}
                onErrorChange={setEmailError}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary"
              />
            )}

            <Button
              type="submit"
              disabled={forgotMutation.isPending}
              className="w-full bg-primary text-secondary hover:bg-primary/90 font-semibold py-2.5"
            >
              {forgotMutation.isPending ? (
                <><Loader2 size={14} className="animate-spin mr-2" />Sending code…</>
              ) : (
                "Send reset code"
              )}
            </Button>
          </form>
        )}

        {step === "verify" && (
          <form onSubmit={handleReset} className="space-y-5">
            {buildDeliveryMessage(deliveryInfo) && (
              <p className="text-white/40 text-xs text-center px-2">{buildDeliveryMessage(deliveryInfo)}</p>
            )}

            <div className="space-y-2">
              <Label className="text-white/70 text-sm">6-digit verification code</Label>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                  <InputOTPGroup className="gap-2">
                    {[0, 1, 2, 3, 4, 5].map(i => (
                      <InputOTPSlot
                        key={i}
                        index={i}
                        className="h-11 w-11 border-white/20 bg-white/5 text-white text-lg rounded-lg"
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>

            <div>
              <Label htmlFor="new-password" className="text-white/70 text-sm">New password</Label>
              <PasswordInput
                id="new-password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                containerClassName="mt-1.5"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary"
              />
            </div>

            <Button
              type="submit"
              disabled={resetMutation.isPending}
              className="w-full bg-primary text-secondary hover:bg-primary/90 font-semibold py-2.5"
            >
              {resetMutation.isPending ? (
                <><Loader2 size={14} className="animate-spin mr-2" />Updating…</>
              ) : (
                "Reset password"
              )}
            </Button>

            <button
              type="button"
              onClick={() => setStep("request")}
              className="w-full text-white/40 text-sm hover:text-white/60"
            >
              Didn't receive code? Send again
            </button>
          </form>
        )}

        {step === "done" && (
          <div className="text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
              <span className="text-2xl">✓</span>
            </div>
            <p className="text-white/60 text-sm">Your password has been updated successfully.</p>
            <Button
              onClick={() => setLocation(loginPath)}
              className="w-full bg-primary text-secondary hover:bg-primary/90 font-semibold"
            >
              Back to sign in
            </Button>
          </div>
        )}

        <div className="mt-6">
          <Link
            href={loginPath}
            className="inline-flex items-center gap-1.5 text-white/40 text-sm hover:text-primary transition-colors"
          >
            <ArrowLeft size={14} />
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}

function buildDeliveryMessage(info: {
  sentSms?: boolean;
  sentEmail?: boolean;
  maskedPhone?: string;
  maskedEmail?: string | null;
}): string {
  const parts: string[] = [];
  if (info.sentSms && info.maskedPhone) parts.push(`SMS to ${info.maskedPhone}`);
  if (info.sentEmail && info.maskedEmail) parts.push(`email to ${info.maskedEmail}`);
  if (parts.length === 0) return "";
  return `Code sent via ${parts.join(" and ")}. Valid for 15 minutes.`;
}
