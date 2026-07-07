import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar, ExternalLink } from "lucide-react";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { useBranding } from "@/lib/branding";

interface LegalPage {
  id: number;
  slug: string;
  title: string;
  status: "draft" | "published";
  content: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  updatedAt: string;
  publishedAt?: string | null;
}

interface BusinessInfo {
  businessName: string;
  supportEmail: string;
  supportPhone: string;
  city: string;
  state: string;
}

const LEGAL_LINKS = [
  { slug: "privacy-policy", label: "Privacy Policy" },
  { slug: "terms-and-conditions", label: "Terms & Conditions" },
  { slug: "refund-policy", label: "Refund Policy" },
  { slug: "data-deletion", label: "Data Deletion" },
  { slug: "about-us", label: "About Us" },
  { slug: "contact-us", label: "Contact Us" },
];

interface Props {
  slug: string;
}

export default function LegalPageLayout({ slug }: Props) {
  const branding = useBranding();

  const { data: page, isLoading, error } = useQuery<LegalPage>({
    queryKey: ["legal-page", slug],
    queryFn: async () => {
      const res = await fetch(`/api/legal/pages/${slug}`);
      if (!res.ok) throw new Error("Page not found");
      return res.json();
    },
    staleTime: 120_000,
  });

  const { data: businessInfo } = useQuery<BusinessInfo>({
    queryKey: ["business-info"],
    queryFn: async () => {
      const res = await fetch("/api/business-info");
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    staleTime: 300_000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <p className="text-foreground font-display font-bold text-2xl mb-2">Page Not Found</p>
        <p className="text-muted-foreground text-sm mb-6">This legal page is not available yet.</p>
        <Link href="/" className="text-primary hover:underline text-sm">← Back to Home</Link>
      </div>
    );
  }

  const businessName = businessInfo?.businessName ?? branding.companyName ?? branding.brandName;
  const currentSlug = slug;
  const formattedDate = page.updatedAt
    ? new Date(page.updatedAt).toLocaleDateString("en-IN", {
        year: "numeric", month: "long", day: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
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
                  currentSlug === link.slug
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

      {/* Mobile nav */}
      <div className="md:hidden bg-secondary border-b border-white/5 overflow-x-auto">
        <div className="flex items-center gap-1 px-4 py-2 min-w-max">
          {LEGAL_LINKS.map(link => (
            <Link
              key={link.slug}
              href={`/${link.slug}`}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                currentSlug === link.slug
                  ? "bg-primary text-secondary"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Main */}
      <main className="flex-1 py-10 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-2">
              {page.title}
            </h1>
            {formattedDate && (
              <p className="text-muted-foreground text-sm flex items-center gap-1.5">
                <Calendar size={13} />
                Last updated: {formattedDate}
              </p>
            )}
          </div>

          {/* Content */}
          <article
            className="prose prose-neutral dark:prose-invert max-w-none
              prose-headings:font-display prose-headings:font-bold
              prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4
              prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
              prose-p:text-muted-foreground prose-p:leading-relaxed
              prose-li:text-muted-foreground
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline
              prose-strong:text-foreground
              prose-ul:my-4 prose-ol:my-4
              prose-li:my-1.5"
            dangerouslySetInnerHTML={{ __html: page.content }}
          />

          {/* Divider */}
          <hr className="my-12 border-border" />

          {/* Other legal pages */}
          <div className="mt-8">
            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-widest mb-4">
              Other Legal Pages
            </p>
            <div className="flex flex-wrap gap-2">
              {LEGAL_LINKS.filter(l => l.slug !== currentSlug).map(link => (
                <Link
                  key={link.slug}
                  href={`/${link.slug}`}
                  className="inline-flex items-center gap-1 text-xs text-primary border border-primary/20 px-3 py-1.5 rounded-full hover:bg-primary/10 transition-colors"
                >
                  {link.label}
                  <ExternalLink size={10} />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-secondary border-t border-white/5 py-8 px-4 mt-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <BrandLogo variant="full" lazy />
              <div>
                <p className="font-display font-bold text-white text-sm">{businessName}</p>
                <p className="text-white/30 text-xs">
                  {businessInfo ? `${businessInfo.city}, ${businessInfo.state}` : "Varanasi, UP"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-4 text-white/40 text-xs">
              {LEGAL_LINKS.map(link => (
                <Link
                  key={link.slug}
                  href={`/${link.slug}`}
                  className="hover:text-white transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="flex flex-col items-center md:items-end gap-1">
              {businessInfo?.supportEmail && (
                <a
                  href={`mailto:${businessInfo.supportEmail}`}
                  className="text-white/40 hover:text-white text-xs transition-colors"
                >
                  {businessInfo.supportEmail}
                </a>
              )}
              {businessInfo?.supportPhone && (
                <a
                  href={`tel:${businessInfo.supportPhone}`}
                  className="text-white/40 hover:text-white text-xs transition-colors"
                >
                  {businessInfo.supportPhone}
                </a>
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-2">
            <p className="text-white/20 text-xs">
              © {new Date().getFullYear()} {businessName}. All rights reserved.
            </p>
            <p className="text-white/20 text-xs">
              {businessInfo?.city ?? "Varanasi"}, India · GST Compliant
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
