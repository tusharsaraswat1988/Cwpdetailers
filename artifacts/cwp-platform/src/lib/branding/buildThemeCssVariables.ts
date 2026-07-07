/** Default CWP palette — matches current production UI */
export const CWP_THEME_DEFAULTS = {
  primaryColor: "#00cccc",
  secondaryColor: "#212529",
  accentColor: "#e0ffff",
  backgroundColor: "#f5f6f8",
  textColor: "#212529",
} as const;

export type ThemeColorInput = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor?: string | null;
};

function hexToHsl(hex: string): string | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return null;
  let r = parseInt(m[1], 16) / 255;
  let g = parseInt(m[2], 16) / 255;
  let b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      default: h = ((r - g) / d + 4) / 6;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Build full shadcn/Tailwind theme CSS variables from branding colors */
export function buildThemeCssVariables(colors: ThemeColorInput): Record<string, string> {
  const text = colors.textColor ?? "#212529";
  const primaryHsl = hexToHsl(colors.primaryColor) ?? "180 100% 40%";
  const secondaryHsl = hexToHsl(colors.secondaryColor) ?? "220 15% 15%";
  const accentHsl = hexToHsl(colors.accentColor) ?? "180 100% 90%";
  const backgroundHsl = hexToHsl(colors.backgroundColor) ?? "220 20% 97%";
  const textHsl = hexToHsl(text) ?? "220 40% 10%";

  return {
    "--brand-primary": colors.primaryColor,
    "--brand-secondary": colors.secondaryColor,
    "--brand-accent": colors.accentColor,
    "--brand-background": colors.backgroundColor,
    "--brand-text": text,
    "--background": backgroundHsl,
    "--foreground": textHsl,
    "--card": "0 0% 100%",
    "--card-foreground": textHsl,
    "--card-border": "220 20% 90%",
    "--popover": "0 0% 100%",
    "--popover-foreground": textHsl,
    "--popover-border": "220 20% 90%",
    "--primary": primaryHsl,
    "--primary-foreground": secondaryHsl,
    "--secondary": secondaryHsl,
    "--secondary-foreground": "0 0% 100%",
    "--muted": "220 20% 90%",
    "--muted-foreground": "220 10% 40%",
    "--accent": accentHsl,
    "--accent-foreground": primaryHsl,
    "--destructive": "0 84% 60%",
    "--destructive-foreground": "210 40% 98%",
    "--border": "220 20% 90%",
    "--input": "220 20% 90%",
    "--ring": primaryHsl,
    "--status-in-progress": primaryHsl,
    "--status-scheduled": primaryHsl,
  };
}
