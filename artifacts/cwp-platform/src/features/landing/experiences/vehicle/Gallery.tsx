import { LANDING_LAYOUT } from "../../constants";
import { landingImages } from "../../assets";
import { SectionHead } from "../../components/SectionHead";
import { BeforeAfterSlider } from "../shared/BeforeAfterSlider";

const PROCESS = [
  {
    src: landingImages.heroVehicle,
    tag: "At your gate",
    alt: "Doorstep vehicle detailing in Varanasi",
  },
  {
    src: landingImages.evidenceWater,
    tag: "RO process",
    alt: "RO water wash process",
  },
  {
    src: landingImages.appMockup,
    tag: "In your app",
    alt: "Service report in the CWP app",
  },
] as const;

/**
 * Unique question: “Show me the work — not another claim.”
 * Visual proof after pricing reduces purchase anxiety.
 */
export function Gallery() {
  return (
    <section id="work" className="bg-white" data-testid="vehicle-gallery">
      <div
        className={`${LANDING_LAYOUT.maxWidth} ${LANDING_LAYOUT.padX} mx-auto py-20 md:py-24`}
      >
        <SectionHead
          eyebrow="Proof"
          title="Drag to see the difference."
          desc="You saw the price. Here’s what the job looks like — unfiltered, same angle, same day."
        />
        <div className="mt-12">
          <BeforeAfterSlider
            src={landingImages.beforeAfterCar}
            alt="Before and after of a car detailed by CWP"
          />
        </div>
        <div className="mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {PROCESS.map((tile) => (
            <figure
              key={tile.tag}
              className="relative w-[72%] shrink-0 snap-start overflow-hidden rounded-3xl border border-border sm:w-[40%] lg:w-[30%]"
            >
              <img
                src={tile.src}
                alt={tile.alt}
                loading="lazy"
                className="aspect-[4/5] w-full object-cover"
              />
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium text-foreground">
                  {tile.tag}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
