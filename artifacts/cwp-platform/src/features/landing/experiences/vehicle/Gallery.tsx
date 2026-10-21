import { LANDING_LAYOUT } from "../../constants";
import { landingImages } from "../../assets";
import { SectionHead } from "../../components/SectionHead";
import { BeforeAfterSlider } from "../shared/BeforeAfterSlider";

const PROCESS = [
  {
    src: landingImages.heroVehicle,
    tag: "At your gate",
    title: "Zero Travel For You",
    desc: "Self-powered mobile rigs arrive at your home or office parking with pure RO water and power onboard.",
    alt: "Doorstep vehicle detailing in Varanasi",
  },
  {
    src: landingImages.evidenceWater,
    tag: "RO Process",
    title: "Pure De-Mineralized RO Water",
    desc: "Zero TDS purified wash prevents water spot etching and swirl marks on delicate clear coats.",
    alt: "RO water wash process",
  },
  {
    src: landingImages.appMockup,
    tag: "In your app",
    title: "Digital Inspection Report",
    desc: "Before-and-after photos, checklist notes, and time-stamped logs delivered to your dashboard and WhatsApp.",
    alt: "Service report in the CWP app",
  },
] as const;

/**
 * Unique question: “Show me the work — not another claim.”
 * Visual proof after pricing reduces purchase anxiety.
 */
export function Gallery() {
  return (
    <section id="work" className="scroll-mt-20 bg-white" data-testid="vehicle-gallery">
      <div
        className={`${LANDING_LAYOUT.maxWidth} ${LANDING_LAYOUT.padX} mx-auto py-20 md:py-24`}
      >
        <SectionHead
          eyebrow="Proof"
          title="Drag to see the difference."
          desc="Unfiltered results, same angle, same lighting. Slide to inspect paint depth, gloss, and contamination removal."
        />
        <div className="mt-10">
          <BeforeAfterSlider
            src={landingImages.beforeAfterCar}
            alt="Before and after of a car detailed by CWP"
          />
        </div>
        <div className="mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {PROCESS.map((tile) => (
            <div
              key={tile.tag}
              className="group relative flex w-[82%] shrink-0 snap-start flex-col overflow-hidden rounded-3xl border border-border bg-slate-50 transition-all hover:border-border hover:shadow-lg sm:w-auto"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-200">
                <img
                  src={tile.src}
                  alt={tile.alt}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-[11px] font-semibold tracking-wide text-foreground shadow-sm backdrop-blur">
                  {tile.tag}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-base font-semibold text-foreground">
                  {tile.title}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {tile.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
