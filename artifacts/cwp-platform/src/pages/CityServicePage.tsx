import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, IndianRupee } from "lucide-react";
import {
  MarketingPageShell,
  MarketingSection,
  MarketingHeading,
  MarketingBadge,
  MarketingButton,
  MarketingCard,
  MarketingCTA,
  MarketingSpinner,
  MARKETING_SITE_LINKS,
} from "@/features/landing/components/marketing";

async function fetchCityService(citySlug: string, serviceSlug: string) {
  const res = await fetch(`/api/catalog/${citySlug}/${serviceSlug}`);
  if (!res.ok) throw new Error("Not found");
  return res.json() as Promise<{
    service: Record<string, unknown>;
    city: { name: string; slug: string };
    cityContent: Record<string, unknown> | null;
    addons: Array<{ id: number; name: string; basePrice: string; description?: string }>;
  }>;
}

const RESERVED_SLUGS = new Set([
  "admin",
  "customer",
  "staff",
  "franchisee",
  "login",
  "register",
  "privacy-policy",
  "terms-and-conditions",
  "refund-policy",
  "data-deletion",
  "about-us",
  "contact-us",
]);

export default function CityServicePage() {
  const params = useParams<{ citySlug: string; serviceSlug: string }>();
  const citySlug = params.citySlug ?? "";
  const serviceSlug = params.serviceSlug ?? "";

  if (RESERVED_SLUGS.has(citySlug)) {
    return (
      <MarketingPageShell>
        <MarketingSection className="flex justify-center">
          <MarketingButton href="/" variant="outline">
            Back to Home
          </MarketingButton>
        </MarketingSection>
      </MarketingPageShell>
    );
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ["city-service", citySlug, serviceSlug],
    queryFn: () => fetchCityService(citySlug, serviceSlug),
    enabled: !!serviceSlug,
  });

  if (isLoading) {
    return (
      <MarketingPageShell showFooter={false}>
        <div className="flex min-h-[40vh] items-center justify-center">
          <MarketingSpinner />
        </div>
      </MarketingPageShell>
    );
  }

  if (error || !data) {
    return (
      <MarketingPageShell>
        <MarketingSection className="flex flex-col items-center gap-4 text-center">
          <p className="text-muted-foreground">Service not found in this city.</p>
          <MarketingButton href="/" variant="outline">
            Back to Home
          </MarketingButton>
        </MarketingSection>
      </MarketingPageShell>
    );
  }

  const svc = data.service;
  const content = data.cityContent;
  const title =
    (content?.seoTitle as string) ?? (svc.seoTitle as string) ?? (svc.name as string);
  const description =
    (content?.shortDescription as string) ??
    (content?.longDescription as string) ??
    (svc.shortDescription as string) ??
    (svc.description as string);
  const benefits = (content?.benefits as string[]) ?? (svc.benefits as string[]) ?? [];

  return (
    <MarketingPageShell navLinks={MARKETING_SITE_LINKS}>
      <MarketingSection narrow>
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft size={14} aria-hidden /> Home
          </Link>
          <MarketingBadge variant="outline">
            <MapPin size={12} aria-hidden />
            {data.city.name}
          </MarketingBadge>
        </div>

        <p className="text-sm font-medium capitalize text-[color:var(--landing-accent)]">
          {citySlug.replace(/-/g, " ")}
        </p>
        <MarketingHeading title={title} description={description} className="mt-1" />
        <p className="mt-4 flex items-center gap-1 font-display text-2xl font-bold">
          <IndianRupee size={22} aria-hidden />
          {String(svc.basePrice ?? "—")}
          <span className="ml-1 text-sm font-normal text-muted-foreground">GST inclusive</span>
        </p>

        {benefits.length > 0 ? (
          <section className="mt-10">
            <h2 className="mb-3 font-display text-lg font-semibold">Benefits</h2>
            <ul className="space-y-2">
              {benefits.map((b, i) => (
                <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="text-[color:var(--landing-accent)]" aria-hidden>
                    ✓
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {data.addons.length > 0 ? (
          <section className="mt-10">
            <h2 className="mb-3 font-display text-lg font-semibold">Available Add-ons</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {data.addons.map((addon) => (
                <MarketingCard key={addon.id} className="p-4 md:p-4">
                  <p className="font-medium text-foreground">{addon.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{addon.description}</p>
                  <p className="mt-2 text-sm font-semibold">₹{addon.basePrice}</p>
                </MarketingCard>
              ))}
            </div>
          </section>
        ) : null}

        <div className="mt-10">
          <MarketingCTA
            title={`Book in ${data.city.name}`}
            description="Create an account to schedule this service with photo reports in the app."
            primaryLabel={`Book in ${data.city.name}`}
            primaryHref="/register"
            secondaryLabel="Back to home"
            secondaryHref="/"
          />
        </div>
      </MarketingSection>
    </MarketingPageShell>
  );
}
