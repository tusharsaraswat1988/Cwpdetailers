import { useState } from "react";
import { useSendAuthOtp, useVerifyAuthOtp } from "@workspace/api-client-react";
import type { AuthResponse } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { PasswordInput } from "@/components/ui/password-input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { submitMobile } from "@/lib/contactForm";
import { getApiErrorMessage } from "@/lib/apiError";
import { Loader2 } from "lucide-react";

type OtpPurpose = "login" | "signup";

type PhoneOtpAuthPanelProps = {
  purpose: OtpPurpose;
  dark?: boolean;
  signupName?: string;
  signupPassword?: string;
  onSuccess: (data: AuthResponse) => void;
};

export function PhoneOtpAuthPanel({
  purpose,
  dark = false,
  signupName = "",
  signupPassword = "",
  onSuccess,
}: PhoneOtpAuthPanelProps) {
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [name, setName] = useState(signupName);
  const [password, setPassword] = useState(signupPassword);

  const sendMutation = useSendAuthOtp({
    mutation: {
      onSuccess: (data) => {
        setOtpSent(true);
        toast({
          title: "OTP sent",
          description: data.maskedPhone ? `SMS sent to ${data.maskedPhone}` : "Check your phone for the OTP.",
        });
      },
      onError: (err: unknown) => {
        toast({
          title: "Could not send OTP",
          description: getApiErrorMessage(err, "Please try again."),
          variant: "destructive",
        });
      },
    },
  });

  const verifyMutation = useVerifyAuthOtp({
    mutation: {
      onSuccess: (data) => {
        toast({ title: purpose === "signup" ? "Account created" : "Signed in" });
        onSuccess(data);
      },
      onError: (err: unknown) => {
        toast({
          title: "Verification failed",
          description: getApiErrorMessage(err, "Invalid or expired OTP."),
          variant: "destructive",
        });
      },
    },
  });

  const labelClass = dark ? "text-white/70 text-sm" : undefined;
  const inputClass = dark
    ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary"
    : undefined;

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    const phoneResult = submitMobile(phone);
    setPhoneError(phoneResult.ok ? null : phoneResult.error);
    if (!phoneResult.ok) {
      toast({ title: phoneResult.error, variant: "destructive" });
      return;
    }

    const trimmedName = name.trim();
    if (purpose === "signup" && !trimmedName) {
      toast({ title: "Enter your name first", variant: "destructive" });
      return;
    }

    sendMutation.mutate({
      data: {
        phone: phoneResult.value,
        purpose,
        ...(purpose === "signup" ? { name: trimmedName } : {}),
      },
    });
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast({ title: "Enter the 6-digit OTP", variant: "destructive" });
      return;
    }

    const phoneResult = submitMobile(phone);
    if (!phoneResult.ok) {
      toast({ title: phoneResult.error, variant: "destructive" });
      return;
    }

    verifyMutation.mutate({
      data: {
        phone: phoneResult.value,
        code: otp,
        purpose,
        ...(purpose === "signup"
          ? {
              name: name.trim(),
              ...(password.trim() ? { password: password.trim() } : {}),
            }
          : {}),
      },
    });
  };

  const pending = sendMutation.isPending || verifyMutation.isPending;

  return (
    <div className="space-y-4" data-testid={`otp-auth-${purpose}`}>
      {!otpSent ? (
        <form onSubmit={handleSendOtp} className="space-y-4">
          {purpose === "signup" && (
            <div>
              <Label htmlFor={`otp-name-${purpose}`} className={labelClass}>Full name</Label>
              <Input
                id={`otp-name-${purpose}`}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="yourname"
                autoComplete="name"
                className={`mt-1.5 ${inputClass ?? ""}`}
                data-testid="input-otp-signup-name"
              />
            </div>
          )}

          <PhoneInput
            id={`otp-phone-${purpose}`}
            label="Mobile number"
            dark={dark}
            placeholder={dark ? "your mobile number" : undefined}
            value={phone}
            onChange={setPhone}
            error={phoneError}
            onErrorChange={setPhoneError}
            className={inputClass}
            data-testid="input-otp-phone"
          />

          <Button
            type="submit"
            disabled={pending}
            className={dark ? "w-full bg-primary text-secondary hover:bg-primary/90 font-semibold" : "w-full"}
            data-testid="btn-send-otp"
          >
            {sendMutation.isPending ? (
              <><Loader2 size={14} className="animate-spin mr-2" />Sending OTP…</>
            ) : (
              "Send OTP"
            )}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="space-y-4">
          <p className={dark ? "text-white/50 text-sm text-center" : "text-muted-foreground text-sm text-center"}>
            Enter the 6-digit OTP sent to your mobile
          </p>

          <div className="flex justify-center">
            <InputOTP maxLength={6} value={otp} onChange={setOtp}>
              <InputOTPGroup>
                {Array.from({ length: 6 }).map((_, i) => (
                  <InputOTPSlot key={i} index={i} className={dark ? "border-white/20 text-white" : undefined} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          {purpose === "signup" && (
            <div>
              <Label htmlFor={`otp-password-${purpose}`} className={labelClass}>
                Password <span className="text-white/40">(optional)</span>
              </Label>
              <PasswordInput
                id={`otp-password-${purpose}`}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={dark ? "your password" : "Set a password for phone login"}
                containerClassName="mt-1.5"
                className={inputClass}
                data-testid="input-otp-signup-password"
              />
            </div>
          )}

          <Button
            type="submit"
            disabled={pending}
            className={dark ? "w-full bg-primary text-secondary hover:bg-primary/90 font-semibold" : "w-full"}
            data-testid="btn-verify-otp"
          >
            {verifyMutation.isPending ? (
              <><Loader2 size={14} className="animate-spin mr-2" />Verifying…</>
            ) : purpose === "signup" ? (
              "Verify & create account"
            ) : (
              "Verify & sign in"
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            className={dark ? "w-full text-white/50 hover:text-white hover:bg-white/10" : "w-full"}
            onClick={() => {
              setOtpSent(false);
              setOtp("");
            }}
            data-testid="btn-change-otp-phone"
          >
            Change phone number
          </Button>
        </form>
      )}
    </div>
  );
}
