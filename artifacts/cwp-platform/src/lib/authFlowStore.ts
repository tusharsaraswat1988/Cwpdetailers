import { create } from "zustand";

export type AuthFlowPurpose = "login" | "signup";
export type AuthPortal = "customer" | "staff" | "admin" | "franchisee";

export type OtpSession = {
  purpose: AuthFlowPurpose;
  phone: string;
  maskedPhone?: string;
  name?: string;
  /** Collected at signup; sent with OTP verify so later logins skip SMS. */
  password?: string;
};

type AuthFlowState = {
  otpSession: OtpSession | null;
  showOtp: boolean;
  setOtpSession: (session: OtpSession) => void;
  clearOtpSession: () => void;
};

export const useAuthFlowStore = create<AuthFlowState>((set) => ({
  otpSession: null,
  showOtp: false,
  setOtpSession: (session) => set({ otpSession: session, showOtp: true }),
  clearOtpSession: () => set({ otpSession: null, showOtp: false }),
}));
