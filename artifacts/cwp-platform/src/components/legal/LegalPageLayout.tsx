import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Calendar, ExternalLink } from "lucide-react";
import { useBranding } from "@/lib/branding";
import {
  MarketingPageShell,
  MarketingSection,
  MarketingHeading,
  MarketingBadge,
  MarketingButton,
  MarketingSpinner,
  MarketingLegalSubnav,
  MARKETING_LEGAL_LINKS,
  MARKETING_SITE_LINKS,
} from "@/features/landing/components/marketing";

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
      <MarketingPageShell showFooter={false}>
        <div className="flex min-h-[50vh] items-center justify-center">
          <MarketingSpinner />
        </div>
      </MarketingPageShell>
    );
  }

  if (error || !page) {
    return (
      <MarketingPageShell>
        <MarketingSection narrow className="flex flex-col items-center text-center">
          <MarketingHeading title="Page Not Found" description="This legal page is not available yet." />
          <MarketingButton href="/" variant="primary" className="mt-6">
            Back to Home
          </MarketingButton>
        </MarketingSection>
      </MarketingPageShell>
    );
  }

  const formattedDate = page.updatedAt
    ? new Date(page.updatedAt).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <MarketingPageShell navLinks={MARKETING_SITE_LINKS} activeHref={`/${slug}`}>
      <MarketingLegalSubnav activeHref={`/${slug}`} />

      <MarketingSection narrow>
        <div className="mb-8">
          <MarketingHeading title={page.title} as="h1" />
          {formattedDate ? (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Calendar size={13} aria-hidden />
              Last updated: {formattedDate}
            </p>
          ) : null}
        </div>

        <article
          className="marketing-prose prose prose-neutral max-w-none
            prose-headings:font-display prose-headings:font-bold
            prose-h2:mb-4 prose-h2:mt-8 prose-h2:text-2xl
            prose-h3:mb-3 prose-h3:mt-6 prose-h3:text-lg
            prose-p:leading-relaxed prose-p:text-muted-foreground
            prose-li:text-muted-foreground
            prose-strong:text-foreground
            prose-ul:my-4 prose-ol:my-4
            prose-li:my-1.5"
          dangerouslySetInnerHTML={{ __html: page.content }}
        />

        <hr className="my-12 border-border" />

        <div>
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Other pages
          </p>
          <div className="flex flex-wrap gap-2">
            {MARKETING_LEGAL_LINKS.filter((l) => l.href !== `/${slug}`).map((link) => (
              <Link
                key={link.id}
                href={link.href}
                className="inline-flex items-center gap-1 rounded-full border border-[color:var(--landing-accent)]/25 px-3 py-1.5 text-xs text-[color:var(--landing-accent)] transition-colors hover:bg-[color:var(--landing-surface-tint)]"
              >
                {link.label}
                <ExternalLink size={10} aria-hidden />
              </Link>
            ))}
          </div>
          {businessInfo?.city || branding.brandName ? (
            <p className="mt-8 text-xs text-muted-foreground">
              <MarketingBadge variant="muted">
                {businessInfo?.city ?? "Varanasi"}
                {businessInfo?.state ? `, ${businessInfo.state}` : ""}
              </MarketingBadge>
            </p>
          ) : null}
        </div>
      </MarketingSection>
    </MarketingPageShell>
  );
}
