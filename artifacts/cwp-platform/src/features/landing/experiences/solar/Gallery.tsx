import { LANDING_LAYOUT } from "../../constants";
import { landingImages } from "../../assets";
import { SectionHead } from "../../components/SectionHead";
import { BeforeAfterSlider } from "../shared/BeforeAfterSlider";

/**
 * Unique question: “Show me cleaned panels / process visuals.”
 */
export function Gallery() {
  return (
    <section id="work" className="bg-[color:var(--landing-surface-tint)]/25" data-testid="solar-gallery">
      <div
        className={`${LANDING_LAYOUT.maxWidth} ${LANDING_LAYOUT.padX} mx-auto py-20 md:py-24`}
      >
        <SectionHead
          eyebrow="Results"
          title="See the glass change."
          desc="After price comes proof — drag the handle, then glance at real rooftop work."
        />
        <div className="mt-12">
          <BeforeAfterSlider
            src={landingImages.beforeAfterSolar}
            alt="Before and after of solar panels cleaned by CWP"
          />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-3xl border border-border">
            <img
              src={landingImages.heroSolar}
              alt="Rooftop solar cleaning at sunrise"
              loading="lazy"
              className="aspect-[16/10] w-full object-cover"
            />
          </figure>
          <figure className="overflow-hidden rounded-3xl border border-border">
            <img
              src={landingImages.founder}
              alt="CWP field work documentation"
              loading="lazy"
              className="aspect-[16/10] w-full object-cover"
            />
          </figure>
        </div>
      </div>
    </section>
  );
}
