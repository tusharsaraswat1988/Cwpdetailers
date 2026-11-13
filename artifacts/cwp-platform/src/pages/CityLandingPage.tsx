import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  MapPin,
  Sparkles,
  ShieldCheck,
  Droplet,
  CheckCircle2,
  ArrowRight,
  IndianRupee,
  Star,
  HelpCircle,
  Phone,
} from "lucide-react";
import { usePageSeo } from "@/lib/branding";
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

const RESERVED_SLUGS = new Set([
  "admin",
  "customer",
  "staff",
  "franchisee",
  "manager",
  "login",
  "register",
  "verify-otp",
  "forgot-password",
  "privacy-policy",
  "terms-and-conditions",
  "refund-policy",
  "data-deletion",
  "about-us",
  "contact-us",
  "solar",
  "vehicle",
]);

interface CityLandingData {
  city: {
    id: number;
    name: string;
    slug: string;
    code: string;
    status: string;
  };
  pageTitle: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  canonicalUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string | null;
  heroHeadline: string;
  heroSubheadline: string;
  customFaqs: Array<{ question: string; answer: string }>;
  customTestimonials: Array<{ author: string; rating: number; review: string; vehicle?: string; society?: string }>;
  localizedContent: Record<string, unknown>;
  isPublished: boolean;
  availableServices: Array<{
    serviceId: number;
    serviceName: string;
    serviceSlug: string;
    categoryName?: string;
    basePrice?: number;
    startingPrice?: number;
    description?: string;
    supportedVehicleCategories?: string[];
  }>;
}

export default function CityLandingPage() {
  const params = useParams<{ citySlug: string }>();
  const citySlug = params.citySlug ?? "";

  if (RESERVED_SLUGS.has(citySlug)) {
    return (
      <MarketingPageShell>
        <MarketingSection className="flex justify-center">
          <MarketingButton href="/vehicle" variant="outline">
            Back to Home
          </MarketingButton>
        </MarketingSection>
      </MarketingPageShell>
    );
  }

  const { data, isLoading, error } = useQuery<CityLandingData>({
    queryKey: ["marketing-city-landing", citySlug],
    queryFn: async () => {
      const res = await fetch(`/api/marketing/city-landing/${citySlug}`);
      if (!res.ok) throw new Error("City not found");
      return res.json();
    },
    enabled: !!citySlug,
    staleTime: 60000,
  });

  usePageSeo({
    title: data?.seoTitle || (data?.city?.name ? `${data.city.name} Car Detailing & Cleaning | CWP Detailers` : "CWP Detailers"),
    description: data?.seoDescription || "Premium doorstep car wash, vehicle detailing, and daily cleaning.",
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

  if (error || !data) {
    return (
      <MarketingPageShell>
        <MarketingSection className="flex flex-col items-center gap-4 text-center py-16">
          <p className="text-xl font-bold text-foreground">City Not Found</p>
          <p className="text-sm text-muted-foreground">
            We currently do not have operations launched under &quot;{citySlug}&quot;.
          </p>
          <MarketingButton href="/vehicle" variant="outline">
            Explore Available Cities
          </MarketingButton>
        </MarketingSection>
      </MarketingPageShell>
    );
  }

  const cityName = data.city.name;
  const services = data.availableServices || [];
  const faqs = data.customFaqs || [];
  const testimonials = data.customTestimonials || [];

  return (
    <MarketingPageShell navLinks={MARKETING_SITE_LINKS}>
      {/* City Hero Section */}
      <MarketingSection className="pt-8 pb-12">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B1D36] via-[#0E274D] to-[#123668] text-white p-8 sm:p-12 shadow-xl">
          <div className="relative z-10 max-w-3xl space-y-5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/30 text-xs font-semibold backdrop-blur-xs">
              <MapPin size={14} className="text-blue-300" />
              <span>Doorstep Services in {cityName}</span>
            </div>

            <h1 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl text-white tracking-tight leading-tight">
              {data.heroHeadline}
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              {data.heroSubheadline}
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-3">
              <Link
                href="/customer/schedule"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-[#1264db] text-white text-sm font-bold shadow-md transition-all cursor-pointer"
              >
                Book Service in {cityName} <ArrowRight size={16} />
              </Link>
              <Link
                href="/customer/plans"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold border border-white/15 transition-all cursor-pointer"
              >
                View Monthly Packages
              </Link>
            </div>
          </div>
        </div>
      </MarketingSection>

      {/* Available Services in City */}
      <MarketingSection className="py-10">
        <div className="text-center max-w-2xl mx-auto mb-8 space-y-2">
          <MarketingBadge>Available in {cityName}</MarketingBadge>
          <MarketingHeading level={2}>Services Active in {cityName}</MarketingHeading>
          <p className="text-sm text-muted-foreground">
            Configuration-driven catalog. Every service is fulfilled by verified technicians at your parking bay.
          </p>
        </div>

        {services.length === 0 ? (
          <div className="text-center p-8 rounded-2xl border border-dashed border-border bg-muted/20">
            <p className="text-sm font-medium text-foreground">Services Launching Soon</p>
            <p className="text-xs text-muted-foreground mt-1">
              We are finalizing technician onboarding in {cityName}. Check back shortly!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((svc) => (
              <MarketingCard key={svc.serviceId} className="flex flex-col justify-between p-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">
                      {svc.categoryName || "Service"}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Active in {cityName}
                    </span>
                  </div>

                  <h3 className="font-display font-bold text-lg text-foreground">
                    {svc.serviceName}
                  </h3>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {svc.description || `Professional doorstep ${svc.serviceName.toLowerCase()} in ${cityName}.`}
                  </p>
                </div>

                <div className="pt-6 mt-4 border-t border-border flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Starting from</span>
                    <span className="font-display font-bold text-base text-foreground inline-flex items-center">
                      <IndianRupee size={14} className="mr-0.5" />
                      {(svc.startingPrice || svc.basePrice || 499).toLocaleString("en-IN")}
                    </span>
                  </div>

                  <Link
                    href={`/customer/schedule?serviceId=${svc.serviceId}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-[#1264db] text-white text-xs font-semibold shadow-xs transition-colors"
                  >
                    Book Now <ArrowRight size={13} />
                  </Link>
                </div>
              </MarketingCard>
            ))}
          </div>
        )}
      </MarketingSection>

      {/* Why Choose Us Pillars */}
      <MarketingSection className="py-10 bg-muted/30 rounded-3xl">
        <div className="text-center max-w-2xl mx-auto mb-8 space-y-2">
          <MarketingBadge>CWP Standard</MarketingBadge>
          <MarketingHeading level={2}>Why Vehicle Owners in {cityName} Trust CWP</MarketingHeading>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-card border border-border shadow-2xs space-y-2">
            <Droplet className="text-blue-600 mb-2" size={24} />
            <h4 className="font-bold text-sm text-foreground">100% RO Water</h4>
            <p className="text-xs text-muted-foreground">
              Zero mineral scaling or borewell spots. Guaranteed mirror finish on automotive clear coats.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-card border border-border shadow-2xs space-y-2">
            <ShieldCheck className="text-emerald-600 mb-2" size={24} />
            <h4 className="font-bold text-sm text-foreground">Zero Scratch Care</h4>
            <p className="text-xs text-muted-foreground">
              Fresh 600 GSM microfiber towels for every panel, preventing swirl marks and scratches.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-card border border-border shadow-2xs space-y-2">
            <CheckCircle2 className="text-indigo-600 mb-2" size={24} />
            <h4 className="font-bold text-sm text-foreground">Verified Technicians</h4>
            <p className="text-xs text-muted-foreground">
              Aadhaar & Police-verified background checked technicians assigned persistently to your society.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-card border border-border shadow-2xs space-y-2">
            <Sparkles className="text-amber-600 mb-2" size={24} />
            <h4 className="font-bold text-sm text-foreground">Photo Reports</h4>
            <p className="text-xs text-muted-foreground">
              Instant before/after photos and inspection updates delivered directly to your dashboard.
            </p>
          </div>
        </div>
      </MarketingSection>

      {/* Localized Testimonials */}
      {testimonials.length > 0 && (
        <MarketingSection className="py-10">
          <div className="text-center max-w-2xl mx-auto mb-8 space-y-2">
            <MarketingBadge>Customer Feedback</MarketingBadge>
            <MarketingHeading level={2}>Loved in {cityName}</MarketingHeading>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {testimonials.map((item, idx) => (
              <MarketingCard key={idx} className="p-6 space-y-3">
                <div className="flex items-center gap-1 text-amber-500">
                  {Array.from({ length: item.rating || 5 }).map((_, i) => (
                    <Star key={i} size={14} className="fill-amber-400" />
                  ))}
                </div>
                <p className="text-xs text-foreground italic leading-relaxed">
                  &ldquo;{item.review}&rdquo;
                </p>
                <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">{item.author}</span>
                  <span>{item.vehicle || item.society || cityName}</span>
                </div>
              </MarketingCard>
            ))}
          </div>
        </MarketingSection>
      )}

      {/* Localized FAQs */}
      {faqs.length > 0 && (
        <MarketingSection className="py-10">
          <div className="text-center max-w-2xl mx-auto mb-8 space-y-2">
            <MarketingBadge>Have Questions?</MarketingBadge>
            <MarketingHeading level={2}>Frequently Asked Questions in {cityName}</MarketingHeading>
          </div>

          <div className="max-w-2xl mx-auto space-y-4">
            {faqs.map((faq, idx) => (
              <div key={idx} className="p-5 rounded-2xl bg-card border border-border space-y-1.5 shadow-2xs">
                <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <HelpCircle size={15} className="text-primary shrink-0" />
                  {faq.question}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </MarketingSection>
      )}

      {/* Final Call to Action */}
      <MarketingSection className="py-12">
        <MarketingCTA
          title={`Experience Doorstep Vehicle Care in ${cityName}`}
          description={`Join thousands of satisfied vehicle owners across ${cityName}. Book your first doorstep service today.`}
          primaryAction={{
            label: `Book Now in ${cityName}`,
            href: "/customer/schedule",
          }}
          secondaryAction={{
            label: "Explore Plans",
            href: "/customer/plans",
          }}
        />
      </MarketingSection>
    </MarketingPageShell>
  );
}
