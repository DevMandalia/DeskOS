/** Canonical D2 palette. Hex values match theme/tokens.css. */

export const THEME_STORAGE_KEY = "desk-theme";
export const LEGACY_THEME_KEYS = ["deskos-theme", "decision-desk-theme"] as const;

export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const PREFERENCES = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof PREFERENCES)[number];

/** Click-cycle order for the header theme button. System stays the default. */
export function nextPreference(current: ThemePreference): ThemePreference {
  const i = PREFERENCES.indexOf(current);
  return PREFERENCES[(i + 1) % PREFERENCES.length];
}

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
  bg: "#F4F4EF",
  surface: "#FFFFFF",
  surface2: "#F7F7F3",
  text: "#141414",
  textMuted: "#55554F",
  border: "#E6E6DF",
  accent: "#278552",
  accentContrast: "#FFFFFF",
  danger: "#AC4934",
  warning: "#946318",
  success: "#278552",
  focusRing: "#278552",
  teal: "#278552",
  orange: "#AC4934",
  info: "#4C6684",
  onAccentSoft: "#257B4C",
  onFill: "#FFFFFF",
  card: "#FFFFFF",
  secondary: "#55554F",
  selected: "#ECECE4",
  hover: "#F1F1EB",
  object: "#141414",
} as const;

export const DARK = {
  bg: "#0E0F11",
  surface: "#17181B",
  surface2: "#1D1E22",
  text: "#F2F2EF",
  textMuted: "#B4B4AE",
  border: "#26272C",
  accent: "#3DBA76",
  accentContrast: "#0B0C0D",
  danger: "#E2896F",
  warning: "#DDA64F",
  success: "#3DBA76",
  focusRing: "#3DBA76",
  teal: "#3DBA76",
  tealFill: "#3DBA76",
  orange: "#E2896F",
  info: "#93AACA",
  onAccentSoft: "#3DBA76",
  onFill: "#0B0C0D",
  card: "#17181B",
  secondary: "#B4B4AE",
  selected: "#26282E",
  hover: "#1F2024",
  object: "#F4F4EF",
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
