/** Canonical palette. Hex values match the current desk look (no restyle). */

export const THEME_STORAGE_KEY = "desk-theme";
export const LEGACY_THEME_KEYS = ["deskos-theme", "decision-desk-theme"] as const;

export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const PREFERENCES = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof PREFERENCES)[number];

export function isTheme(value: string | null | undefined): value is Theme {
  return value === "light" || value === "dark";
}

export function isPreference(
  value: string | null | undefined,
): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function parsePreference(
  value: string | null | undefined,
): ThemePreference {
  return isPreference(value) ? value : "system";
}

export function resolveTheme(pref: ThemePreference, systemDark: boolean): Theme {
  if (pref === "system") return systemDark ? "dark" : "light";
  return pref;
}

export function readStoredPreference(
  getItem: (key: string) => string | null,
): ThemePreference {
  const stored = getItem(THEME_STORAGE_KEY);
  if (isPreference(stored)) return stored;
  for (const key of LEGACY_THEME_KEYS) {
    const legacy = getItem(key);
    if (isTheme(legacy)) return legacy;
  }
  return "system";
}

export const LIGHT = {
  bg: "#f6f3ec",
  surface: "#fffdf8",
  surface2: "#efeadf",
  text: "#1d1b18",
  textMuted: "#625d55",
  border: "#e3ddd0",
  accent: "#1f5f5b",
  accentContrast: "#fffdf8",
  danger: "#9e4724",
  warning: "#9e4724",
  success: "#1f5f5b",
  focusRing: "#1f5f5b",
  teal: "#1f5f5b",
  orange: "#9e4724",
  onFill: "#fffdf8",
  card: "#fffdf8",
  secondary: "#625d55",
} as const;

export const DARK = {
  bg: "#16140f",
  surface: "#1e1b16",
  surface2: "#2a261f",
  text: "#f6f3ec",
  textMuted: "#c9c2b7",
  border: "#4a4338",
  accent: "#8ec9c3",
  accentContrast: "#fffdf8",
  danger: "#e09262",
  warning: "#e09262",
  success: "#8ec9c3",
  focusRing: "#8ec9c3",
  teal: "#8ec9c3",
  tealFill: "#1f5f5b",
  orange: "#e09262",
  onFill: "#fffdf8",
  card: "#1e1b16",
  secondary: "#c9c2b7",
} as const;

export function relativeLuminance(hex: string): number {
  const raw = hex.replace("#", "");
  const channels = [0, 2, 4].map((start) => {
    const value = parseInt(raw.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}
