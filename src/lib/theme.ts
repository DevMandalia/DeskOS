export const THEME_STORAGE_KEY = "decision-desk-theme";

export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export function isTheme(value: string | null | undefined): value is Theme {
  return value === "light" || value === "dark";
}

/** Inline <head> boot: set data-theme before first paint. Keep this a pure string. */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){
  try {
    var key = ${JSON.stringify(THEME_STORAGE_KEY)};
    var stored = localStorage.getItem(key);
    var theme = (stored === "light" || stored === "dark")
      ? stored
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    var root = document.documentElement;
    root.setAttribute("data-theme", theme);
    root.style.colorScheme = theme;
    root.style.backgroundColor = theme === "dark" ? "#16140f" : "#f6f3ec";
  } catch (e) {}
})();`;

export const LIGHT = {
  bg: "#f6f3ec",
  card: "#fffdf8",
  text: "#1d1b18",
  secondary: "#625d55",
  teal: "#1f5f5b",
  orange: "#b4522b",
  onFill: "#fffdf8",
} as const;

export const DARK = {
  bg: "#16140f",
  card: "#1e1b16",
  text: "#f6f3ec",
  secondary: "#c9c2b7",
  teal: "#8ec9c3",
  tealFill: "#1f5f5b",
  orange: "#e09262",
  onFill: "#fffdf8",
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
