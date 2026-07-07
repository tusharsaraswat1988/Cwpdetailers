import { INDIAN_MOBILE_REGEX } from "@workspace/validation";

/** Display 10-digit Indian mobile as "98765 43210". */
export function formatIndianMobileDisplay(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)} ${d.slice(5)}`;
}

export function stripIndianMobileDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

export function isValidIndianMobileDigits(digits: string): boolean {
  return INDIAN_MOBILE_REGEX.test(digits);
}

/** Premium OTP display: +91 98765 43XXX */
export function formatOtpMaskedPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) return phone;
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5, 7)}XXX`;
}