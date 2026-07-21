import { landingImages } from "../assets";
import { DIVISION_COLORS } from "../constants";
import type { HeroContentBundle } from "./heroTypes";

/**
 * Static default hero content (Varanasi EN).
 * Swap via CMS / A-B / locale by passing a different HeroContentBundle into <Hero />.
 */
export const defaultHeroContent: HeroContentBundle = {
  selector: {
    label: "Personalize your experience",
    title: "What would you like us to take care of today?",
    orLabel: "OR",
    options: [
      {
        id: "vehicle",
        title: "My Vehicle",
        description: "Keep your car looking new and performing at its best.",
        accent: DIVISION_COLORS.vehicle.accent,
        icon: "car",
      },
      {
        id: "solar",
        title: "My Solar Plant",
        description: "Maximize energy, efficiency and long-term returns.",
        accent: DIVISION_COLORS.solar.accent,
        icon: "sun",
      },
    ],
  },
  vehicle: {
    contentKey: "hero.vehicle.default",
    locale: "en-IN",
    locationLabel: "Serving Varanasi & 8 surrounding areas",
    headline: {
      eyebrow: "Doorstep Vehicle Care",
      before: "Ab gaadiyaan hongi",
      emphasis: "roj saaf",
      after: ".",
    },
    subheading:
      "Doorstep foam wash, interior detailing and ceramic protection — trained CWP specialists at your gate, every week.",
    socialProof: {
      ratingLabel: "4.9/5",
      ownersLabel: "Loved by 1,247 Varanasi owners this year",
      avatarInitials: ["A", "R", "P", "N", "S"],
    },
    trustPills: [
      { id: "doorstep", label: "Doorstep weekly plans — managed in the app", icon: "camera" },
    ],
    ctas: [
      {
        id: "vehicle-book",
        label: "Book your first service",
        href: "/register",
        variant: "primary",
      },
      {
        id: "vehicle-plans",
        label: "See plans & rates",
        href: "#packages",
        variant: "secondary",
      },
    ],
    media: {
      kind: "image",
      src: landingImages.heroVehicle,
      alt: "CWP technician detailing a car in Varanasi",
      width: 1600,
      height: 1200,
    },
    liveChip: "Varanasi · doorstep specialists",
    stats: {
      label: "Owner rating",
      value: "4.9",
      hint: "Across active plans",
    },
    tintClass: DIVISION_COLORS.vehicle.tintClass,
  },
  solar: {
    contentKey: "hero.solar.default",
    locale: "en-IN",
    locationLabel: "Serving Varanasi & 8 surrounding areas",
    headline: {
      eyebrow: "Professional Solar Care",
      before: "Dust is settling on",
      emphasis: "your profits",
      after: ", not your panels.",
    },
    subheading:
      "Dust silently steals generation long before panels look dirty. We’ll show the science, prove the inverter gap, then estimate your rooftop.",
    socialProof: {
      ratingLabel: "4.9/5",
      ownersLabel: "Trusted by rooftop & society clients in Varanasi",
      avatarInitials: ["A", "R", "P", "N", "S"],
    },
    trustPills: [
      { id: "inverter", label: "Recovery measured on your inverter logs", icon: "zap" },
    ],
    ctas: [
      {
        id: "solar-calc",
        label: "Estimate my loss",
        href: "#calculator",
        variant: "primary",
      },
      {
        id: "solar-science",
        label: "Why dust matters",
        href: "#science",
        variant: "secondary",
      },
    ],
    media: {
      kind: "image",
      src: landingImages.heroSolar,
      alt: "CWP technician cleaning solar panels at sunrise in Varanasi",
      width: 1600,
      height: 1200,
    },
    liveChip: "Varanasi · scientific panel care",
    stats: {
      label: "Typical soiling window",
      value: "30d",
      hint: "Before loss compounds",
    },
    tintClass: DIVISION_COLORS.solar.tintClass,
  },
};
