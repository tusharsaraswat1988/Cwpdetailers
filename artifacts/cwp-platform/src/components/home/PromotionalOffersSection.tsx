import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tag, Sparkles, Copy, Check, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

interface PromotionalOffersSectionProps {
  citySlug?: string;
  cityName?: string;
}

type CampaignPromo = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  offerType: string;
  discountValue: string;
  minOrderAmount?: string | null;
  maxDiscountAmount?: string | null;
  cityName?: string | null;
};

export function PromotionalOffersSection({ citySlug, cityName }: PromotionalOffersSectionProps) {
  const { toast } = useToast();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const { data } = useQuery<{ campaigns: CampaignPromo[] }>({
    queryKey: ["customer-promotional-offers", citySlug || "global"],
    queryFn: async () => {
      const params = new URLSearchParams({ status: "active" });
      if (citySlug) params.set("citySlug", citySlug);
      const res = await fetch(`/api/marketing/campaigns?${params.toString()}`);
      if (!res.ok) return { campaigns: [] };
      return res.json();
    },
    staleTime: 60000,
  });

  const campaigns = data?.campaigns || [];
  if (campaigns.length === 0) return null;

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
    toast({
      title: "Coupon Copied!",
      description: `Code "${code}" copied. Apply at review step during booking.`,
    });
  };

  return (
    <div className="space-y-3" data-testid="promotional-offers-section">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Tag size={15} className="text-primary" />
          <h2 className="font-display font-bold text-sm text-foreground">
            {cityName ? `Special Offers in ${cityName}` : "Featured Offers & Rewards"}
          </h2>
        </div>
        <span className="text-[11px] text-muted-foreground">Limited Time</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {campaigns.slice(0, 2).map((camp) => (
          <div
            key={camp.id}
            className="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-50/80 via-blue-50/60 to-cyan-50/40 border border-blue-200/70 flex flex-col justify-between gap-3 shadow-2xs"
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono font-bold text-[11px]">
                  <Sparkles size={11} /> {camp.code}
                </span>
                <span className="text-xs font-bold text-indigo-700">
                  {camp.offerType === "percentage_discount" ? `${camp.discountValue}% OFF` : `₹${camp.discountValue} OFF`}
                </span>
              </div>
              <p className="font-bold text-xs text-foreground mt-1">{camp.name}</p>
              {camp.description && (
                <p className="text-[11px] text-muted-foreground line-clamp-1">{camp.description}</p>
              )}
            </div>

            <div className="pt-2 border-t border-blue-100 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => handleCopy(camp.code)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/80 cursor-pointer"
              >
                {copiedCode === camp.code ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                {copiedCode === camp.code ? "Copied" : "Copy Code"}
              </button>

              <Link
                href="/customer/schedule"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-foreground hover:text-primary transition-colors"
              >
                Book Now <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PromotionalOffersSection;
