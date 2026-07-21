import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Mail, Phone, MapPin, MessageCircle, Clock, ExternalLink } from "lucide-react";
import { useBranding } from "@/lib/branding";
import {
  MarketingPageShell,
  MarketingSection,
  MarketingHeading,
  MarketingCard,
  MarketingCTA,
  MarketingSpinner,
  MarketingLegalSubnav,
  MARKETING_SITE_LINKS,
  MARKETING_LEGAL_LINKS,
} from "@/features/landing/components/marketing";

interface BusinessInfo {
  businessName: string;
  ownerName: string;
  businessType: string;
  supportEmail: string;
  supportPhone: string;
  whatsappNumber?: string | null;
  alternatePhone?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  pinCode: string;
  country: string;
  facebook?: string | null;
  instagram?: string | null;
  youtube?: string | null;
  linkedin?: string | null;
  twitter?: string | null;
}

export default function ContactUs() {
  const branding = useBranding();

  const { data: info, isLoading } = useQuery<BusinessInfo>({
    queryKey: ["business-info"],
    queryFn: async () => {
      const res = await fetch("/api/business-info");
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    staleTime: 300_000,
  });

  const businessName = info?.businessName ?? branding.companyName ?? branding.brandName;
  const whatsapp = info?.whatsappNumber ?? info?.supportPhone;

  return (
    <MarketingPageShell navLinks={MARKETING_SITE_LINKS} activeHref="/contact-us">
      <MarketingLegalSubnav activeHref="/contact-us" />

      <MarketingSection>
        <div className="mx-auto max-w-4xl">
          <MarketingHeading
            title="Contact Us"
            description="We are here to help. Reach out through any channel below."
          />

          {isLoading ? (
            <div className="flex justify-center py-12">
              <MarketingSpinner />
            </div>
          ) : (
            <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
              <MarketingCard>
                <h2 className="font-display text-lg font-bold text-foreground">{businessName}</h2>
                {info?.businessType ? (
                  <p className="mb-4 text-sm text-muted-foreground">
                    {info.businessType} · Owner: {info.ownerName}
                  </p>
                ) : null}
                <div className="space-y-3">
                  <ContactRow
                    icon={Mail}
                    label="Email"
                    href={`mailto:${info?.supportEmail ?? "cwpdetailers@gmail.com"}`}
                    value={info?.supportEmail ?? "cwpdetailers@gmail.com"}
                  />
                  <ContactRow
                    icon={Phone}
                    label="Phone"
                    href={`tel:${info?.supportPhone ?? "+917054007733"}`}
                    value={info?.supportPhone ?? "+91-7054007733"}
                  />
                  {whatsapp ? (
                    <ContactRow
                      icon={MessageCircle}
                      label="WhatsApp"
                      href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
                      value={whatsapp}
                      external
                    />
                  ) : null}
                </div>
              </MarketingCard>

              <div className="space-y-4">
                <MarketingCard>
                  <div className="flex items-start gap-3">
                    <IconWell icon={MapPin} />
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground">Address</p>
                      <p className="text-sm font-medium leading-relaxed text-foreground">
                        {info?.addressLine1 ?? "Seer Goverdhanpur, Behind BHU"}
                        {info?.addressLine2 ? (
                          <>
                            <br />
                            {info.addressLine2}
                          </>
                        ) : null}
                        <br />
                        {info?.city ?? "Varanasi"}, {info?.state ?? "Uttar Pradesh"}{" "}
                        {info?.pinCode ?? "221005"}
                        <br />
                        {info?.country ?? "India"}
                      </p>
                    </div>
                  </div>
                </MarketingCard>

                <MarketingCard>
                  <div className="flex items-start gap-3">
                    <IconWell icon={Clock} />
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground">Business Hours</p>
                      <div className="space-y-0.5 text-sm text-muted-foreground">
                        <p>
                          <span className="font-medium text-foreground">Mon – Sat</span> · 8:00 AM –
                          8:00 PM
                        </p>
                        <p>
                          <span className="font-medium text-foreground">Sunday</span> · 9:00 AM – 6:00
                          PM
                        </p>
                      </div>
                    </div>
                  </div>
                </MarketingCard>
              </div>

              <div className="md:col-span-2">
                <MarketingCTA
                  title="Ready to book a service?"
                  description="Create a free account to book car wash, detailing, and solar care."
                  primaryLabel="Book Now"
                  primaryHref="/register"
                />
              </div>

              {(info?.instagram ??
                info?.facebook ??
                info?.youtube ??
                info?.linkedin ??
                info?.twitter) && (
                <MarketingCard className="md:col-span-2">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Follow Us
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {info?.instagram ? (
                      <a
                        href={info.instagram}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-[color:var(--landing-accent)] hover:underline"
                      >
                        Instagram
                      </a>
                    ) : null}
                    {info?.facebook ? (
                      <a
                        href={info.facebook}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-[color:var(--landing-accent)] hover:underline"
                      >
                        Facebook
                      </a>
                    ) : null}
                    {info?.youtube ? (
                      <a
                        href={info.youtube}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-[color:var(--landing-accent)] hover:underline"
                      >
                        YouTube
                      </a>
                    ) : null}
                    {info?.linkedin ? (
                      <a
                        href={info.linkedin}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-[color:var(--landing-accent)] hover:underline"
                      >
                        LinkedIn
                      </a>
                    ) : null}
                    {info?.twitter ? (
                      <a
                        href={info.twitter}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-[color:var(--landing-accent)] hover:underline"
                      >
                        X / Twitter
                      </a>
                    ) : null}
                  </div>
                </MarketingCard>
              )}
            </div>
          )}

          <hr className="my-12 border-border" />
          <div className="flex flex-wrap gap-2">
            {MARKETING_LEGAL_LINKS.filter((l) => l.href !== "/contact-us").map((link) => (
              <Link
                key={link.id}
                href={link.href}
                className="inline-flex items-center gap-1 rounded-full border border-[color:var(--landing-accent)]/25 px-3 py-1.5 text-xs text-[color:var(--landing-accent)] transition-colors hover:bg-[color:var(--landing-surface-tint)]"
              >
                {link.label} <ExternalLink size={10} aria-hidden />
              </Link>
            ))}
          </div>
        </div>
      </MarketingSection>
    </MarketingPageShell>
  );
}

function IconWell({ icon: Icon }: { icon: typeof Mail }) {
  return (
    <div className="marketing-icon-well flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
      <Icon size={16} aria-hidden />
    </div>
  );
}

function ContactRow({
  icon: Icon,
  label,
  href,
  value,
  external,
}: {
  icon: typeof Mail;
  label: string;
  href: string;
  value: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="group flex items-center gap-3 text-sm"
    >
      <IconWell icon={Icon} />
      <div>
        <p className="mb-0.5 text-xs text-muted-foreground">{label}</p>
        <p className="font-medium text-foreground transition-colors group-hover:text-[color:var(--landing-accent)]">
          {value}
        </p>
      </div>
    </a>
  );
}
