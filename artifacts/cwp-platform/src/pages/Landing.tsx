import { Link } from "wouter";
import { motion } from "framer-motion";
import { useListServices } from "@workspace/api-client-react";
import { useHomepagePlans, useHomepageSections } from "@/features/service-catalog/api";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { useBranding } from "@/lib/branding";
import { Sun, Car, Shield, Sparkles, ChevronRight, MapPin, Phone, Star, Zap, Droplets, Check } from "lucide-react";

const serviceIcons: Record<string, React.ElementType> = {
  car_wash: Droplets,
  detailing: Sparkles,
  ceramic_coating: Shield,
  ppf: Shield,
  solar_cleaning: Sun,
  amc: Zap,
  subscription: Star,
};

const carWashPlans = [
  {
    name: "Daily Exterior Clean",
    price: "1,000",
    priceNote: "/month",
    desc: "Your car cleaned every single morning before you head out.",
    features: ["Daily exterior foam wash", "Tyre shine", "Window wipe", "Available 8–10 AM"],
    tag: null,
    highlight: false,
  },
  {
    name: "1 Time Wash",
    price: "600",
    priceNote: "/month (5 seater)",
    price2: "700",
    price2Note: "/month (5+ seater)",
    desc: "One full wash per month — perfect for occasional deep cleans.",
    features: ["1 full wash/month", "Exterior foam wash", "Interior vacuum", "Glass cleaning", "Tyre polish"],
    tag: null,
    highlight: false,
  },
  {
    name: "Daily Clean + 1 Full Wash",
    price: "1,300",
    priceNote: "/month (5 seater)",
    price2: "1,600",
    price2Note: "/month (5+ seater)",
    desc: "Daily exterior clean + one thorough interior+exterior full wash monthly.",
    features: ["Daily exterior wash", "1 full wash/month", "Interior vacuum & polish", "Foam wash + glass clean", "Tyre polish"],
    tag: "POPULAR",
    highlight: true,
  },
  {
    name: "Daily Clean + 2 Full Washes",
    price: "1,600",
    priceNote: "/month (5 seater)",
    price2: "1,900",
    price2Note: "/month (5+ seater)",
    desc: "Daily care with two premium full washes per month — best value.",
    features: ["Daily exterior wash", "2 full washes/month", "Interior vacuum & polish", "Foam wash + glass clean", "Tyre polish"],
    tag: "BEST VALUE",
    highlight: false,
  },
  {
    name: "Wash Card",
    price: "1,600",
    priceNote: "(5 seater)",
    price2: "1,900",
    price2Note: "(5+ seater)",
    desc: "4 full washes, valid for 4 months. Use at your convenience.",
    features: ["4 full washes", "4 month validity", "Exterior + interior wash", "No monthly commitment", "Book any time"],
    tag: "FLEXIBLE",
    highlight: false,
  },
];

const solarTiers = [
  {
    range: "1–30 Panels",
    oneTime: "₹60",
    sixMonth: "₹50",
    twelveMonth: "₹45",
    suffix: "per panel",
  },
  {
    range: "30–100 Panels",
    oneTime: "₹50",
    sixMonth: "₹45",
    twelveMonth: "₹40",
    suffix: "per panel",
  },
  {
    range: "100+ Panels",
    oneTime: "—",
    sixMonth: "—",
    twelveMonth: "—",
    note: "Site visit required",
  },
];

const testimonials = [
  { name: "Arjun Sharma", city: "Varanasi", rating: 5, text: "My BMW has never looked better. The ceramic coating service is truly premium — I've tried services in Delhi and Pune, nothing compares." },
  { name: "Pooja Chauhan", city: "Varanasi", rating: 5, text: "The daily wash subscription is a game-changer. They show up at 8 AM, car is spotless before I leave for office. Completely reliable." },
  { name: "Meena Gupta", city: "Varanasi", rating: 5, text: "Solar panel output went up 22% after their cleaning. The efficiency report they send is very detailed. Worth every rupee of the AMC." },
];

const cities = ["Varanasi"];

export default function Landing() {
  const { data: services } = useListServices({ isActive: true });
  const { data: homepagePlans } = useHomepagePlans("varanasi");
  const { data: homepageSections } = useHomepageSections();
  const branding = useBranding();

  const heroSection = homepageSections?.find(s => s.sectionKey === "hero");
  const citiesSection = homepageSections?.find(s => s.sectionKey === "cities");
  const testimonialsSection = homepageSections?.find(s => s.sectionKey === "testimonials");
  const statsSection = homepageSections?.find(s => s.sectionKey === "stats");

  const cmsCities = (citiesSection?.content as { cities?: Array<{ name: string; slug: string; active?: boolean }> })?.cities;
  const displayCities = cmsCities?.filter(c => c.active !== false).map(c => c.name) ?? cities;

  const cmsTestimonials = (testimonialsSection?.content as { items?: typeof testimonials })?.items;
  const displayTestimonials = cmsTestimonials ?? testimonials;

  const displayPlans = (homepagePlans ?? []).length > 0
    ? (homepagePlans ?? []).map(p => ({
        name: p.name,
        price: Number(p.price).toLocaleString("en-IN"),
        priceNote: p.source === "dcms"
          ? "/month"
          : p.validityDays
            ? `/${Math.max(1, Math.round(p.validityDays / 30))} month${p.validityDays > 30 ? "s" : ""}`
            : p.durationMonths
              ? `/${p.durationMonths === 1 ? "month" : `${p.durationMonths} months`}`
              : "",
        price2: undefined as string | undefined,
        price2Note: undefined as string | undefined,
        desc: p.description ?? (p.scopeLabel ? `${p.scopeLabel}` : ""),
        features: p.features ?? [],
        tag: p.tag,
        highlight: p.isHighlighted,
      }))
    : carWashPlans;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-40 bg-secondary/95 backdrop-blur border-b border-white/5 safe-area-top">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo variant="navbar" lazy={false} />
            <div>
              <p className="font-display font-bold text-white text-base leading-tight">{branding.brandName}</p>
              <p className="text-white/40 text-xs">{branding.tagline ?? branding.companyName}</p>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-white/60">
            <a href="#services" className="hover:text-white transition-colors">Services</a>
            <a href="#plans" className="hover:text-white transition-colors">Car Wash Plans</a>
            <a href="#solar" className="hover:text-white transition-colors">Solar Cleaning</a>
            <a href="#testimonials" className="hover:text-white transition-colors">Reviews</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/5">Sign in</Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="bg-primary text-secondary hover:bg-primary/90 font-semibold">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative bg-secondary overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(180,100%,40%,0.12),transparent_60%)]" />
        <div className="relative max-w-7xl mx-auto px-6 py-28 md:py-36">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-primary text-sm font-medium mb-6">
              <MapPin size={12} />
              <span>Serving Varanasi</span>
            </div>
            <h1 className="font-display font-bold text-5xl md:text-7xl text-white leading-[1.05] mb-6">
              Your car deserves<br />
              <span className="text-primary">expert care.</span>
            </h1>
            <p className="text-white/60 text-lg md:text-xl leading-relaxed mb-10 max-w-xl">
              Premium car detailing, ceramic coating, and solar panel cleaning — by certified technicians, at your doorstep.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/register">
                <Button size="lg" className="bg-primary text-secondary hover:bg-primary/90 font-bold text-base px-8" data-testid="btn-hero-cta">
                  Book Your First Service <ChevronRight size={16} className="ml-1" />
                </Button>
              </Link>
              <a href="#plans">
                <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/5 font-medium text-base px-8">
                  View Plans & Rates
                </Button>
              </a>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.6 }} className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl">
            {[["2,400+", "Cars Served"], ["98%", "Satisfaction Rate"], ["3", "Cities"], ["8", "Service Types"]].map(([num, label]) => (
              <div key={label} className="text-center">
                <p className="font-display font-bold text-2xl text-primary">{num}</p>
                <p className="text-white/40 text-xs mt-0.5">{label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="py-20 px-6 max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} viewport={{ once: true }} className="mb-12">
          <h2 className="font-display font-bold text-3xl md:text-4xl mb-3">What we do best</h2>
          <p className="text-muted-foreground text-lg">Professional services with certified technicians and premium products.</p>
        </motion.div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {(services || []).slice(0, 9).map((service, i) => {
            const Icon = serviceIcons[service.category] || Car;
            return (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.4 }}
                viewport={{ once: true }}
                className="group bg-card border border-border rounded-2xl p-6 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all"
                data-testid={`service-card-${service.id}`}
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <Icon size={20} className="text-primary" />
                </div>
                <h3 className="font-semibold text-base mb-1">{service.name}</h3>
                <p className="text-muted-foreground text-sm mb-4 line-clamp-2">{service.description}</p>
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold text-lg text-primary">
                    from ₹{Number(service.basePrice).toLocaleString("en-IN")}
                  </span>
                  {service.durationMinutes && (
                    <span className="text-xs text-muted-foreground">{service.durationMinutes >= 60 ? `${service.durationMinutes / 60}h` : `${service.durationMinutes}m`}</span>
                  )}
                </div>
                {Array.isArray(service.features) && service.features.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(service.features as string[]).slice(0, 3).map(f => (
                      <span key={f} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{f}</span>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Car Wash Subscription Plans */}
      <section id="plans" className="py-20 bg-secondary">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} viewport={{ once: true }} className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-primary text-sm font-medium mb-4">
              <Car size={12} />
              <span>Car Wash Subscription Packages</span>
            </div>
            <h2 className="font-display font-bold text-3xl md:text-4xl text-white mb-3">Daily Car Care Plans</h2>
            <p className="text-white/50 text-lg max-w-xl mx-auto">
              Choose the plan that fits your lifestyle. All plans cover Varanasi. Full wash includes interior vacuuming, foam wash, tyre polish & glass cleaning.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
            {displayPlans.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                viewport={{ once: true }}
                className={`relative rounded-2xl p-6 border flex flex-col ${
                  plan.highlight
                    ? "bg-primary border-primary/40"
                    : "bg-white/5 border-white/10 hover:border-white/20"
                } transition-all`}
                data-testid={`plan-card-${i}`}
              >
                {plan.tag && (
                  <div className={`absolute -top-3 left-5 text-xs font-bold px-3 py-1 rounded-full ${
                    plan.highlight ? "bg-secondary text-primary border border-primary/30" : "bg-primary text-secondary"
                  }`}>
                    {plan.tag}
                  </div>
                )}

                <div className="mb-4">
                  <h3 className={`font-display font-bold text-lg mb-1 ${plan.highlight ? "text-secondary" : "text-white"}`}>
                    {plan.name}
                  </h3>
                  <p className={`text-sm ${plan.highlight ? "text-secondary/70" : "text-white/50"}`}>{plan.desc}</p>
                </div>

                {/* Price */}
                <div className={`rounded-xl p-4 mb-4 ${plan.highlight ? "bg-secondary/15" : "bg-white/5"}`}>
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className={`font-display font-bold text-2xl ${plan.highlight ? "text-secondary" : "text-primary"}`}>₹{plan.price}</span>
                    <span className={`text-xs ${plan.highlight ? "text-secondary/60" : "text-white/40"}`}>{plan.priceNote}</span>
                  </div>
                  {plan.price2 && (
                    <div className="flex items-baseline gap-1.5 flex-wrap mt-1">
                      <span className={`font-display font-bold text-2xl ${plan.highlight ? "text-secondary" : "text-primary"}`}>₹{plan.price2}</span>
                      <span className={`text-xs ${plan.highlight ? "text-secondary/60" : "text-white/40"}`}>{plan.price2Note}</span>
                    </div>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className={`flex items-center gap-2 text-sm ${plan.highlight ? "text-secondary/80" : "text-white/60"}`}>
                      <Check size={13} className={plan.highlight ? "text-secondary" : "text-primary"} />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link href="/register">
                  <Button className={`w-full font-semibold ${
                    plan.highlight
                      ? "bg-secondary text-primary hover:bg-secondary/90"
                      : "bg-primary text-secondary hover:bg-primary/90"
                  }`}>
                    Subscribe Now
                  </Button>
                </Link>
              </motion.div>
            ))}
          </div>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-white/30 text-xs">
              * Full wash includes interior vacuuming, dashboard polish, exterior foam wash, tyre polish & glass cleaning.
            </p>
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5">
              <span className="text-white/50 text-xs font-medium">GST 18% applicable on all prices</span>
              <span className="text-white/30 text-xs">·</span>
              <span className="text-white/40 text-xs">Provide GSTIN for input tax credit bill</span>
            </div>
          </div>
        </div>
      </section>

      {/* Solar Cleaning Section */}
      <section id="solar" className="py-20 px-6 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-14 items-start">
          {/* Left: copy */}
          <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }} viewport={{ once: true }}>
            <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 text-amber-500 text-sm font-medium mb-5">
              <Sun size={12} />
              <span>{branding.companyName}{branding.tagline ? ` — ${branding.tagline}` : ""}</span>
            </div>
            <h2 className="font-display font-bold text-3xl md:text-4xl mb-4">
              Dirty panels cost you money.
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed mb-6">
              A layer of dust can cut solar output by up to 40%. Our professional cleaning uses deionised water and soft brushes — leaving zero residue, zero scratches, maximum efficiency.
            </p>
            <div className="space-y-3 mb-8">
              {[
                ["40%*", "Max efficiency gain after cleaning"],
                ["Zero", "Scratches or residue on panels"],
                ["3", "Contract durations: 1 time, 6M, 12M"],
                ["100+", "Panels? We visit site & quote specially"],
              ].map(([stat, label]) => (
                <div key={label} className="flex items-center gap-4">
                  <span className="font-display font-bold text-primary text-xl w-16 flex-shrink-0">{stat}</span>
                  <span className="text-muted-foreground text-sm">{label}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3 flex-wrap">
              <Link href="/register">
                <Button className="bg-amber-500 text-white hover:bg-amber-600 font-semibold">
                  Book Solar Cleaning
                </Button>
              </Link>
              <a href="tel:8707488250">
                <Button variant="outline" className="border-amber-500/30 text-amber-500 hover:bg-amber-500/10">
                  <Phone size={14} className="mr-2" />8707488250
                </Button>
              </a>
            </div>
            <p className="text-muted-foreground text-xs mt-4">
              📍 Seer Govardhan, BHU, Varanasi &nbsp;·&nbsp; kleansolar.co
            </p>
          </motion.div>

          {/* Right: pricing table */}
          <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }} viewport={{ once: true }}>
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="bg-amber-500/10 border-b border-amber-500/20 px-5 py-4">
                <h3 className="font-display font-bold text-base">Services & Rates</h3>
                <p className="text-muted-foreground text-xs mt-0.5">GST extra applicable</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Panel Count</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">One Time</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-amber-500 uppercase tracking-wide">6 Months</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-primary uppercase tracking-wide">12 Months</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {solarTiers.map((tier, i) => (
                      <tr key={tier.range} className={i === 1 ? "bg-primary/5" : ""} data-testid={`solar-tier-${i}`}>
                        <td className="px-5 py-4 font-semibold text-sm">{tier.range}</td>
                        {tier.note ? (
                          <td colSpan={3} className="px-4 py-4 text-center text-muted-foreground text-sm italic">
                            {tier.note}
                          </td>
                        ) : (
                          <>
                            <td className="px-4 py-4 text-center">
                              <span className="font-bold text-base">{tier.oneTime}</span>
                              {tier.suffix && <span className="text-xs text-muted-foreground block">{tier.suffix}</span>}
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="font-bold text-base text-amber-500">{tier.sixMonth}</span>
                              {tier.suffix && <span className="text-xs text-muted-foreground block">{tier.suffix}</span>}
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="font-bold text-base text-primary">{tier.twelveMonth}</span>
                              {tier.suffix && <span className="text-xs text-muted-foreground block">{tier.suffix}</span>}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Contract savings highlight */}
              <div className="border-t border-border px-5 py-4 bg-primary/5">
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    { label: "One Time", saving: "Full price", color: "text-foreground" },
                    { label: "6-Month AMC", saving: "Save ~17%", color: "text-amber-500" },
                    { label: "12-Month AMC", saving: "Save ~25%", color: "text-primary" },
                  ].map(({ label, saving, color }) => (
                    <div key={label}>
                      <p className="text-xs font-semibold">{label}</p>
                      <p className={`text-xs font-bold mt-0.5 ${color}`}>{saving}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Example calc */}
            <div className="mt-4 bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-sm">
              <p className="font-semibold text-amber-600 mb-1">Example: 20 panels, 12-month AMC</p>
              <p className="text-muted-foreground text-xs">
                20 panels × ₹45 = <strong className="text-foreground">₹900 per cleaning</strong> × 12 visits = <strong className="text-primary">₹10,800/year</strong>
                {" "}vs one-time rate of ₹1,200/visit. <span className="text-green-600 font-medium">You save ₹3,600.</span>
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 bg-secondary">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} viewport={{ once: true }} className="text-center mb-12">
            <h2 className="font-display font-bold text-3xl md:text-4xl text-white mb-3">What our customers say</h2>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-5">
            {displayTestimonials.map((t, i) => (
              <motion.div key={t.name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1, duration: 0.5 }} viewport={{ once: true }}
                className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => <Star key={i} size={14} fill="currentColor" className="text-primary" />)}
                </div>
                <p className="text-white/70 text-sm leading-relaxed mb-5">"{t.text}"</p>
                <div>
                  <p className="text-white font-medium text-sm">{t.name}</p>
                  <p className="text-white/40 text-xs">{t.city}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA + contact */}
      <section className="py-16 px-6 max-w-7xl mx-auto">
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="font-display font-bold text-2xl md:text-3xl mb-2">Ready to get started?</h2>
            <p className="text-muted-foreground">Register online or call us directly to book your first service.</p>
            <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-muted-foreground">
              <a href="tel:8707488250" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                <Phone size={13} className="text-primary" />8707 48250
              </a>
              <a href="tel:7054007733" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                <Phone size={13} className="text-primary" />7054 07733
              </a>
              <div className="flex items-center gap-1.5">
                <MapPin size={13} className="text-primary" />Seer Govardhan, BHU, Varanasi
              </div>
            </div>
          </div>
          <Link href="/register">
            <Button size="lg" className="bg-primary text-secondary hover:bg-primary/90 font-bold px-8 flex-shrink-0">
              Create Free Account <ChevronRight size={16} className="ml-1" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Cities */}
      <section className="py-8 px-6 max-w-7xl mx-auto border-t border-border">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          <span className="text-muted-foreground text-sm">Currently serving:</span>
          {displayCities.map(city => (
            <div key={city} className="flex items-center gap-1.5 text-sm font-medium">
              <MapPin size={12} className="text-primary" />
              {city}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-secondary border-t border-white/5 py-10 px-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <BrandLogo variant="full" lazy />
              <div>
                <p className="font-display font-bold text-white text-sm">{branding.companyName}</p>
                <p className="text-white/30 text-xs">{branding.tagline ?? branding.address ?? ""}</p>
              </div>
            </div>
            <div className="flex items-center gap-5 text-white/40 text-xs">
              {branding.supportPhone && (
                <a href={`tel:${branding.supportPhone}`} className="hover:text-white transition-colors">{branding.supportPhone}</a>
              )}
              {branding.website && (
                <>
                  {branding.supportPhone && <span>·</span>}
                  <a href={branding.website} className="hover:text-white transition-colors" target="_blank" rel="noreferrer">
                    {branding.website.replace(/^https?:\/\//, "")}
                  </a>
                </>
              )}
            </div>
            <p className="text-white/30 text-xs">© {new Date().getFullYear()} {branding.brandName}. All rights reserved.</p>
          </div>
          {/* Legal links */}
          <div className="border-t border-white/5 pt-5 flex flex-wrap justify-center gap-x-6 gap-y-2">
            {[
              { href: "/about-us", label: "About Us" },
              { href: "/contact-us", label: "Contact Us" },
              { href: "/privacy-policy", label: "Privacy Policy" },
              { href: "/terms-and-conditions", label: "Terms & Conditions" },
              { href: "/refund-policy", label: "Refund Policy" },
              { href: "/data-deletion", label: "Data Deletion" },
            ].map(link => (
              <Link key={link.href} href={link.href} className="text-white/30 hover:text-white/60 text-xs transition-colors">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
