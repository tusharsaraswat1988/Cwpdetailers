export type InstallType = "residential" | "commercial" | "industrial" | "society";
export type CleaningWindow = "15" | "30" | "60" | "90+";

export const CITY_PROFILES: Record<
  string,
  { label: string; tariff: number; sun: number; dustIndex: number }
> = {
  varanasi: { label: "Varanasi", tariff: 8.5, sun: 4.6, dustIndex: 1.15 },
  lucknow: { label: "Lucknow", tariff: 8.0, sun: 4.7, dustIndex: 1.05 },
  delhi: { label: "Delhi NCR", tariff: 9.5, sun: 4.8, dustIndex: 1.25 },
  jaipur: { label: "Jaipur", tariff: 8.2, sun: 5.2, dustIndex: 1.3 },
  kanpur: { label: "Kanpur", tariff: 8.3, sun: 4.6, dustIndex: 1.2 },
  prayagraj: { label: "Prayagraj", tariff: 8.2, sun: 4.6, dustIndex: 1.12 },
  gorakhpur: { label: "Gorakhpur", tariff: 8.0, sun: 4.5, dustIndex: 1.1 },
  patna: { label: "Patna", tariff: 7.8, sun: 4.5, dustIndex: 1.15 },
  mumbai: { label: "Mumbai", tariff: 11.0, sun: 4.9, dustIndex: 0.95 },
  bengaluru: { label: "Bengaluru", tariff: 8.8, sun: 5.0, dustIndex: 0.9 },
};

export const INSTALL_META: Record<
  InstallType,
  { label: string; soilingMult: number; sizeHint: string; icon: "home" | "building" | "factory" | "users" }
> = {
  residential: { label: "Residential", soilingMult: 1, sizeHint: "1–10 kW", icon: "home" },
  commercial: { label: "Commercial", soilingMult: 1.15, sizeHint: "10–100 kW", icon: "building" },
  industrial: { label: "Industrial", soilingMult: 1.35, sizeHint: "100 kW+", icon: "factory" },
  society: { label: "Housing Society", soilingMult: 1.1, sizeHint: "20–200 kW", icon: "users" },
};

export const WINDOW_META: Record<
  CleaningWindow,
  { label: string; days: number; lossPerMonth: number }
> = {
  "15": { label: "Within 15 days", days: 15, lossPerMonth: 0.05 },
  "30": { label: "About a month", days: 30, lossPerMonth: 0.08 },
  "60": { label: "2 months ago", days: 60, lossPerMonth: 0.09 },
  "90+": { label: "3+ months / never", days: 120, lossPerMonth: 0.1 },
};

export function estimateSolarLoss(input: {
  kw: number;
  installType: InstallType;
  cleaningWindow: CleaningWindow;
  cityKey: string;
}) {
  const city = CITY_PROFILES[input.cityKey] ?? CITY_PROFILES.varanasi;
  const win = WINDOW_META[input.cleaningWindow];
  const inst = INSTALL_META[input.installType];
  const monthsElapsed = win.days / 30;
  const rawLoss = win.lossPerMonth * monthsElapsed * inst.soilingMult * city.dustIndex;
  const efficiencyLoss = Math.min(0.3, rawLoss);
  const efficiencyLossPct = Math.round(efficiencyLoss * 1000) / 10;
  const dustGramsPerM2 = Math.min(600, Math.round(win.days * 4 * city.dustIndex));
  const recoverableMonthlyKWh = Math.round(input.kw * city.sun * 30 * efficiencyLoss);
  const annualBenefit = Math.round(recoverableMonthlyKWh * 12 * city.tariff);
  const recommendedDays =
    input.installType === "industrial"
      ? 15
      : input.installType === "commercial" || input.installType === "society"
        ? 21
        : city.dustIndex >= 1.2
          ? 21
          : 30;

  return {
    city,
    win,
    inst,
    dustGramsPerM2,
    efficiencyLossPct,
    recoverableMonthlyKWh,
    annualBenefit,
    recommendedDays,
  };
}
