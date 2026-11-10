import { Star, UserCheck, Quote } from "lucide-react";

export function CustomerReviewsSection() {
  const reviews = [
    {
      id: "rev-home-1",
      name: "Tushar Customer",
      vehicle: "Hyundai Creta · Bhelupur",
      rating: 5,
      comment:
        "Earlier my society cleaner made horrible swirls on the bonnet. Since switching to CWP Daily Care 4 months back, the car looks showroom-ready every morning. Daily photo logs in the app give total transparency!",
    },
    {
      id: "rev-home-2",
      name: "Dr. Ananya Sharma",
      vehicle: "Kia Seltos · Lanka",
      rating: 5,
      comment:
        "The detailers are strictly on time before 8 AM. Having 2 deep foam washes bundled into the monthly subscription is unbeatable value. Varanasi finally has world-class auto detailing.",
    },
    {
      id: "rev-home-3",
      name: "Rameshwar Prasad",
      vehicle: "5kW Rooftop Solar · Sigra",
      rating: 5,
      comment:
        "Solar generation was dropping due to dust build-up. CWP's team cleaned all 16 panels with telescopic soft-brushes and RO water. Generation jumped by nearly 25% the next day!",
    },
  ];

  return (
    <section className="space-y-4 pt-2" aria-labelledby="home-reviews-heading">
      <div className="flex items-center justify-between">
        <div>
          <h2 id="home-reviews-heading" className="font-display font-bold text-lg text-foreground">
            Customer Feedbacks & Love
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Trusted by 5,000+ car & rooftop solar owners across Varanasi
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-50 border border-amber-200/70 text-xs font-bold text-amber-800">
          <Star size={13} className="fill-amber-500 text-amber-500" />
          <span>4.9 / 5.0 Rating</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {reviews.map((rev) => (
          <div
            key={rev.id}
            className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_2px_8px_rgba(11,29,54,0.04)] flex flex-col justify-between space-y-3 text-left relative overflow-hidden"
          >
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: rev.rating }).map((_, i) => (
                    <Star key={i} size={13} className="fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <Quote size={16} className="text-slate-200" />
              </div>

              <p className="text-xs text-slate-700 leading-relaxed italic">
                "{rev.comment}"
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-foreground text-xs">{rev.name}</p>
                <p className="text-[10px] text-muted-foreground">{rev.vehicle}</p>
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                <UserCheck size={11} /> Verified
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default CustomerReviewsSection;
