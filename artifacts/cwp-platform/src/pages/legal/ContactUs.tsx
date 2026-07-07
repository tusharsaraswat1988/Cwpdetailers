import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Mail, Phone, MapPin, MessageCircle, Clock, ArrowLeft, ExternalLink } from "lucide-react";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { useBranding } from "@/lib/branding";

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

const LEGAL_LINKS = [
  { slug: "privacy-policy", label: "Privacy Policy" },
  { slug: "terms-and-conditions", label: "Terms & Conditions" },
  { slug: "refund-policy", label: "Refund Policy" },
  { slug: "data-deletion", label: "Data Deletion" },
  { slug: "about-us", label: "About Us" },
  { slug: "contact-us", label: "Contact Us" },
];

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
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-secondary border-b border-white/5 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
            <BrandLogo variant="navbar" lazy={false} />
            <span className="text-white font-display font-bold text-sm hidden sm:block">{businessName}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 flex-wrap">
            {LEGAL_LINKS.map(link => (
              <Link
                key={link.slug}
                href={`/${link.slug}`}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  link.slug === "contact-us"
                    ? "bg-primary text-secondary"
                    : "text-white/50 hover:text-white hover:bg-white/5"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <Link href="/" className="flex items-center gap-1.5 text-white/50 hover:text-white text-xs transition-colors flex-shrink-0">
            <ArrowLeft size={13} />
            <span className="hidden sm:inline">Home</span>
          </Link>
        </div>
      </header>

      <div className="md:hidden bg-secondary border-b border-white/5 overflow-x-auto">
        <div className="flex items-center gap-1 px-4 py-2 min-w-max">
          {LEGAL_LINKS.map(link => (
            <Link
              key={link.slug}
              href={`/${link.slug}`}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                link.slug === "contact-us"
                  ? "bg-primary text-secondary"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      <main className="flex-1 py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-10">
            <h1 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-2">Contact Us</h1>
            <p className="text-muted-foreground">We are here to help. Reach out through any channel below.</p>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-card border border-border rounded-xl p-6">
                <h2 className="font-display font-bold text-foreground text-lg mb-1">{businessName}</h2>
                {info?.businessType && (
                  <p className="text-muted-foreground text-sm mb-4">
                    {info.businessType} · Owner: {info.ownerName}
                  </p>
                )}
                <div className="space-y-3">
                  <a
                    href={`mailto:${info?.supportEmail ?? "cwpdetailers@gmail.com"}`}
                    className="flex items-center gap-3 text-sm group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                      <Mail size={16} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground/60 mb-0.5">Email</p>
                      <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                        {info?.supportEmail ?? "cwpdetailers@gmail.com"}
                      </p>
                    </div>
                  </a>

                  <a
                    href={`tel:${info?.supportPhone ?? "+917054007733"}`}
                    className="flex items-center gap-3 text-sm group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                      <Phone size={16} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground/60 mb-0.5">Phone</p>
                      <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                        {info?.supportPhone ?? "+91-7054007733"}
                      </p>
                    </div>
                  </a>

                  {whatsapp && (
                    <a
                      href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 text-sm group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                        <MessageCircle size={16} className="text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground/60 mb-0.5">WhatsApp</p>
                        <p className="font-medium text-foreground group-hover:text-primary transition-colors">{whatsapp}</p>
                      </div>
                    </a>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-card border border-border rounded-xl p-6">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <MapPin size={16} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground/60 mb-1">Address</p>
                      <p className="font-medium text-foreground text-sm leading-relaxed">
                        {info?.addressLine1 ?? "Seer Goverdhanpur, Behind BHU"}
                        {info?.addressLine2 && <><br />{info.addressLine2}</>}
                        <br />
                        {info?.city ?? "Varanasi"}, {info?.state ?? "Uttar Pradesh"} {info?.pinCode ?? "221005"}
                        <br />
                        {info?.country ?? "India"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-xl p-6">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Clock size={16} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground/60 mb-1">Business Hours</p>
                      <div className="text-sm text-muted-foreground space-y-0.5">
                        <p><span className="text-foreground font-medium">Mon – Sat</span> · 8:00 AM – 8:00 PM</p>
                        <p><span className="text-foreground font-medium">Sunday</span> · 9:00 AM – 6:00 PM</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 bg-primary/5 border border-primary/20 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <p className="font-display font-bold text-foreground text-base">Ready to book a service?</p>
                  <p className="text-muted-foreground text-sm mt-0.5">Create a free account to book car wash, detailing, and more.</p>
                </div>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-primary text-secondary font-bold text-sm rounded-lg hover:bg-primary/90 transition-colors flex-shrink-0"
                >
                  Book Now <ExternalLink size={13} />
                </Link>
              </div>

              {(info?.instagram ?? info?.facebook ?? info?.youtube ?? info?.linkedin ?? info?.twitter) && (
                <div className="md:col-span-2 bg-card border border-border rounded-xl p-6">
                  <p className="text-xs text-muted-foreground/60 mb-3 font-semibold uppercase tracking-widest">Follow Us</p>
                  <div className="flex flex-wrap gap-3">
                    {info?.instagram && <a href={info.instagram} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">Instagram</a>}
                    {info?.facebook && <a href={info.facebook} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">Facebook</a>}
                    {info?.youtube && <a href={info.youtube} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">YouTube</a>}
                    {info?.linkedin && <a href={info.linkedin} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">LinkedIn</a>}
                    {info?.twitter && <a href={info.twitter} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">X / Twitter</a>}
                  </div>
                </div>
              )}
            </div>
          )}

          <hr className="my-12 border-border" />
          <div className="flex flex-wrap gap-2">
            {LEGAL_LINKS.filter(l => l.slug !== "contact-us").map(link => (
              <Link
                key={link.slug}
                href={`/${link.slug}`}
                className="inline-flex items-center gap-1 text-xs text-primary border border-primary/20 px-3 py-1.5 rounded-full hover:bg-primary/10 transition-colors"
              >
                {link.label} <ExternalLink size={10} />
              </Link>
            ))}
          </div>
        </div>
      </main>

      <footer className="bg-secondary border-t border-white/5 py-8 px-4 mt-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <BrandLogo variant="full" lazy />
              <div>
                <p className="font-display font-bold text-white text-sm">{businessName}</p>
                <p className="text-white/30 text-xs">{info?.city ?? "Varanasi"}, {info?.state ?? "UP"}</p>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-4 text-white/40 text-xs">
              {LEGAL_LINKS.map(link => (
                <Link key={link.slug} href={`/${link.slug}`} className="hover:text-white transition-colors">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-white/5 text-center">
            <p className="text-white/20 text-xs">
              &copy; {new Date().getFullYear()} {businessName}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
