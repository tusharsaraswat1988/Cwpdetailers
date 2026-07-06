import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { HelpCircle, Mail, MessageCircle, Phone } from "lucide-react";
import { useBranding } from "@/lib/branding";

type AuthSupportPanelProps = {
  portal: "customer" | "staff";
  className?: string;
};

type BusinessInfo = {
  supportEmail?: string;
  supportPhone?: string;
  whatsappNumber?: string | null;
};

export function AuthSupportPanel({ portal, className }: AuthSupportPanelProps) {
  const branding = useBranding();

  const { data: info } = useQuery<BusinessInfo>({
    queryKey: ["business-info"],
    queryFn: async () => {
      const res = await fetch("/api/business-info");
      if (!res.ok) return {};
      return res.json();
    },
    staleTime: 300_000,
  });

  const supportPhone = info?.supportPhone;
  const supportEmail = info?.supportEmail;
  const whatsapp = info?.whatsappNumber ?? supportPhone;

  return (
    <div
      className={`rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3 ${className ?? ""}`}
      data-testid="auth-support-panel"
    >
      <div className="flex items-start gap-2.5">
        <HelpCircle size={18} className="text-primary mt-0.5 shrink-0" />
        <div>
          <p className="text-white/80 text-sm font-medium">Need help signing in?</p>
          <p className="text-white/40 text-xs mt-0.5 leading-relaxed">
            {portal === "staff"
              ? "Staff accounts are created by admin. Forgot password? Use SMS/email reset below or contact support."
              : "Reset your password via SMS & email, or sign in with Google. Our team is here to help."}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {supportPhone && (
          <a
            href={`tel:${supportPhone}`}
            className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-primary transition-colors px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10"
          >
            <Phone size={13} />
            {supportPhone}
          </a>
        )}
        {supportEmail && (
          <a
            href={`mailto:${supportEmail}`}
            className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-primary transition-colors px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10"
          >
            <Mail size={13} />
            Email support
          </a>
        )}
        {whatsapp && (
          <a
            href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-primary transition-colors px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10"
          >
            <MessageCircle size={13} />
            WhatsApp
          </a>
        )}
      </div>

      <p className="text-white/25 text-xs">
        <Link href="/contact-us" className="text-primary/80 hover:text-primary hover:underline">
          Contact {branding.companyName}
        </Link>
        {" · "}
        <Link href="/privacy-policy" className="hover:text-white/40 hover:underline">
          Privacy
        </Link>
      </p>
    </div>
  );
}
