/**
 * Lead / request source options — mirrors the Postgres `lead_source` enum.
 * Single source for Leads admin UI and Book Services (and any future intake screens).
 */
export const LEAD_SOURCES = [
  "whatsapp",
  "instagram",
  "facebook",
  "website",
  "call",
  "google",
  "walk_in",
  "referral",
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  website: "Website",
  call: "Call",
  google: "Google",
  walk_in: "Walk-in",
  referral: "Referral",
};

export const LEAD_SOURCE_OPTIONS: Array<{ id: LeadSource; label: string }> = LEAD_SOURCES.map(id => ({
  id,
  label: LEAD_SOURCE_LABELS[id],
}));
