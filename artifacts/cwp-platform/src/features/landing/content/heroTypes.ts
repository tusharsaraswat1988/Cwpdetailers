import type { Division } from "../types";

/**
 * CMS / A-B / i18n / branding-ready contracts.
 * Components consume these shapes only — never hardcode copy internally.
 */

export type HeroCtaVariant = "primary" | "secondary" | "ghost";

export type HeroCta = {
  id: string;
  label: string;
  /** App route or hash/tel/https — resolved by HeroCTA */
  href: string;
  variant?: HeroCtaVariant;
  external?: boolean;
};

export type HeroHeadline = {
  eyebrow?: string;
  /** Text before emphasis */
  before: string;
  /** Accented line */
  emphasis: string;
  /** Optional text after emphasis */
  after?: string;
};

export type HeroTrustPill = {
  id: string;
  label: string;
  /** Lucide icon name key resolved by the trust bar */
  icon?: "shield" | "droplets" | "camera" | "zap" | "badgeCheck";
};

export type HeroSocialProof = {
  ratingLabel: string;
  ownersLabel: string;
  /** Initials for avatar stack */
  avatarInitials: string[];
};

export type HeroStat = {
  label: string;
  value: string;
  hint?: string;
};

/** Future-ready media union — image today, video/animation later */
export type HeroMediaSource =
  | {
      kind: "image";
      src: string;
      alt: string;
      width?: number;
      height?: number;
    }
  | {
      kind: "video";
      src: string;
      poster?: string;
      alt: string;
      loop?: boolean;
      muted?: boolean;
      autoPlay?: boolean;
    }
  | {
      kind: "animation";
      /** Lottie / Rive URL or JSON path */
      src: string;
      alt: string;
    };

export type HeroSelectorOption = {
  id: Division;
  title: string;
  description: string;
  /** Accent for icon chip */
  accent: string;
  icon: "car" | "sun";
};

export type HeroSelectorContent = {
  label: string;
  title: string;
  orLabel: string;
  options: [HeroSelectorOption, HeroSelectorOption];
};

export type HeroJourneyContent = {
  /** Stable key for CMS / A-B variants */
  contentKey: string;
  locale?: string;
  locationLabel?: string;
  headline: HeroHeadline;
  subheading: string;
  socialProof?: HeroSocialProof;
  trustPills: HeroTrustPill[];
  ctas: HeroCta[];
  media: HeroMediaSource;
  liveChip?: string;
  stats?: HeroStat;
  /** Tailwind gradient fragment for hero wash */
  tintClass: string;
};

export type HeroContentBundle = {
  vehicle: HeroJourneyContent;
  solar: HeroJourneyContent;
  selector: HeroSelectorContent;
};
