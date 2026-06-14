import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { ArrowLeft, MapPin, IndianRupee } from "lucide-react";

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
  "admin", "customer", "staff", "franchisee", "login", "register",
  "privacy-policy", "terms-and-conditions", "refund-policy", "data-deletion", "about-us", "contact-us",
]);

export default function CityServicePage() {
  const params = useParams<{ citySlug: string; serviceSlug: string }>();
  const citySlug = params.citySlug ?? "";
  const serviceSlug = params.serviceSlug ?? "";

  if (RESERVED_SLUGS.has(citySlug)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Link href="/"><Button variant="outline">Back to Home</Button></Link>
      </div>
    );
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ["city-service", citySlug, serviceSlug],
    queryFn: () => fetchCityService(citySlug, serviceSlug),
    enabled: !!serviceSlug,
  });

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Service not found in this city.</p>
        <Link href="/"><Button variant="outline">Back to Home</Button></Link>
      </div>
    );
  }

  const svc = data.service;
  const content = data.cityContent;
  const title = (content?.seoTitle as string) ?? (svc.seoTitle as string) ?? (svc.name as string);
  const description = (content?.shortDescription as string) ?? (content?.longDescription as string) ?? (svc.shortDescription as string) ?? (svc.description as string);
  const benefits = (content?.benefits as string[]) ?? (svc.benefits as string[]) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/"><BrandLogo variant="navbar" lazy={false} /></Link>
          <Badge variant="outline" className="gap-1"><MapPin size={12} />{data.city.name}</Badge>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={14} /> Home
        </Link>

        <div>
          <p className="text-sm text-primary font-medium capitalize">{citySlug.replace(/-/g, " ")}</p>
          <h1 className="font-display text-3xl font-bold mt-1">{title}</h1>
          <p className="text-muted-foreground mt-2">{description}</p>
          <p className="flex items-center gap-1 mt-4 text-2xl font-bold">
            <IndianRupee size={22} />
            {String(svc.basePrice ?? "—")}
            <span className="text-sm font-normal text-muted-foreground ml-1">GST inclusive</span>
          </p>
        </div>

        {benefits.length > 0 && (
          <section>
            <h2 className="font-semibold text-lg mb-3">Benefits</h2>
            <ul className="space-y-2">
              {benefits.map((b, i) => (
                <li key={i} className="flex gap-2 text-sm"><span className="text-primary">✓</span>{b}</li>
              ))}
            </ul>
          </section>
        )}

        {data.addons.length > 0 && (
          <section>
            <h2 className="font-semibold text-lg mb-3">Available Add-ons</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {data.addons.map(addon => (
                <div key={addon.id} className="border rounded-lg p-4">
                  <p className="font-medium">{addon.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{addon.description}</p>
                  <p className="text-sm font-semibold mt-2">₹{addon.basePrice}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <Link href="/register">
          <Button className="w-full sm:w-auto bg-primary text-secondary">Book in {data.city.name}</Button>
        </Link>
      </main>
    </div>
  );
}
