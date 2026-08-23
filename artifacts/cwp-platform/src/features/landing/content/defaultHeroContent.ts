import { landingImages } from "../assets";
import { DIVISION_COLORS } from "../constants";
import type { HeroContentBundle } from "./heroTypes";

/**
 * Static default hero content (Varanasi EN).
 * Swap via CMS / A-B / locale by passing a different HeroContentBundle into <Hero />.
 *
 * Pricing on the vehicle micro-card matches the published Daily Clean Plan
 * starting price in the vehicle Packages section (₹1,999 / month).
 */
export const defaultHeroContent: HeroContentBundle = {
  selector: {
    label: "",
    title: "What would you like us to take care of?",
    options: [
      {
        id: "vehicle",
        title: "Car Care",
        description: "Daily cleaning, detailing and doorstep plans.",
        accent: DIVISION_COLORS.vehicle.accent,
        icon: "car",
      },
      {
        id: "solar",
        title: "Solar Care",
        description: "Panel cleaning, performance and savings.",
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
      "Regular doorstep cleaning, professional detailing and recurring care plans — trained CWP specialists at your gate, every week.",
    socialProof: {
      ratingLabel: "4.9/5",
      ownersLabel: "Loved by 1,247 Varanasi owners this year",
      avatarInitials: ["A", "R", "P", "N", "S"],
    },
    trustPills: [
      { id: "daily", label: "Daily car cleaning plans", icon: "camera" },
      { id: "detail", label: "Interior & exterior detailing", icon: "droplets" },
      { id: "recurring", label: "Recurring care, managed in the app", icon: "badgeCheck" },
    ],
    credibility: [
      { id: "doorstep", label: "Doorstep specialists" },
      { id: "trained", label: "Trained, uniformed team" },
      { id: "redo", label: "24h re-do promise" },
      { id: "city", label: "Varanasi & nearby" },
    ],
    ctas: [
      {
        id: "vehicle-explore",
        label: "Explore Car Care",
        href: "#services",
        variant: "primary",
      },
      {
        id: "vehicle-plans",
        label: "View Plans",
        href: "#packages",
        variant: "secondary",
      },
    ],
    media: {
      kind: "image",
      src: landingImages.heroVehicle,
      alt: "CWP technician detailing a car at a customer doorstep in Varanasi",
      width: 1600,
      height: 1200,
    },
    liveChip: "Varanasi · doorstep specialists",
    stats: {
      label: "Daily Car Cleaning",
      value: "₹1,999",
      hint: "Starting / month",
    },
    tintClass: DIVISION_COLORS.vehicle.tintClass,
  },
  solar: {
    contentKey: "hero.solar.default",
    locale: "en-IN",
    locationLabel: "Serving Varanasi & 8 surrounding areas",
    headline: {
      eyebrow: "Professional Solar Care",
      before: "Clean panels.",
      emphasis: "Better performance.",
      after: " Higher savings.",
    },
    subheading:
      "Dust blocks light long before panels look dirty. Cleaner panels recover output — estimate what your rooftop may be losing, then book professional cleaning.",
    socialProof: {
      ratingLabel: "4.9/5",
      ownersLabel: "Trusted by rooftop & society clients in Varanasi",
      avatarInitials: ["A", "R", "P", "N", "S"],
    },
    trustPills: [
      { id: "output", label: "Cleaner panels, stronger output", icon: "zap" },
      { id: "savings", label: "Estimate your rooftop savings", icon: "badgeCheck" },
      { id: "maintain", label: "Scheduled professional cleaning", icon: "camera" },
    ],
    credibility: [
      { id: "science", label: "Scientific panel care" },
      { id: "inverter", label: "Inverter-aware cleaning" },
      { id: "trained", label: "Trained specialists" },
      { id: "city", label: "Varanasi & nearby" },
    ],
    ctas: [
      {
        id: "solar-calc",
        label: "Calculate Your Savings",
        href: "#calculator",
        variant: "primary",
      },
      {
        id: "solar-book",
        label: "Book Solar Cleaning",
        href: "#book",
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
