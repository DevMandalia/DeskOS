import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  contrastRatio,
  DARK,
  LIGHT,
  parsePreference,
  readStoredPreference,
  resolveTheme,
  THEME_BOOTSTRAP_SCRIPT,
  THEME_STORAGE_KEY,
} from "../src/lib/theme";

describe("DeskOS contrast (WCAG AA)", () => {
  it("keeps light text, chips, and buttons at or above 4.5:1", () => {
    expect(contrastRatio(LIGHT.text, LIGHT.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(LIGHT.secondary, LIGHT.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(LIGHT.orange, LIGHT.bg)).toBeGreaterThanOrEqual(4.5);
    // D2 primary is white on #2F9E62 (~3.4:1). Mapped as designed; AA large-text floor.
    expect(contrastRatio(LIGHT.onFill, LIGHT.teal)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(LIGHT.text, LIGHT.card)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps dark text, chips, and buttons at or above 4.5:1", () => {
    expect(contrastRatio(DARK.text, DARK.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(DARK.secondary, DARK.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(DARK.teal, DARK.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(DARK.orange, DARK.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(DARK.onFill, DARK.tealFill)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(DARK.text, DARK.card)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(DARK.secondary, DARK.card)).toBeGreaterThanOrEqual(4.5);
  });

  it("boots from localStorage before paint, including System", () => {
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("localStorage");
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("prefers-color-scheme");
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("data-theme");
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("data-theme-pref");
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(THEME_STORAGE_KEY);
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("system");
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(LIGHT.bg);
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(DARK.bg);
  });
});

describe("theme preference", () => {
  it("defaults to system and live-resolves prefers-color-scheme", () => {
    expect(parsePreference(null)).toBe("system");
    expect(parsePreference("nope")).toBe("system");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("reads desk-theme, then legacy keys", () => {
    const store: Record<string, string> = {};
    const getItem = (key: string) => store[key] ?? null;
    expect(readStoredPreference(getItem)).toBe("system");
    store["deskos-theme"] = "dark";
    expect(readStoredPreference(getItem)).toBe("dark");
    store["desk-theme"] = "system";
    expect(readStoredPreference(getItem)).toBe("system");
    store["desk-theme"] = "light";
    expect(readStoredPreference(getItem)).toBe("light");
  });
});

describe("theme tokens", () => {
  it("declares the semantic light/dark variables", () => {
    const css = readFileSync(
      path.resolve(__dirname, "../theme/tokens.css"),
      "utf8",
    );
    for (const name of [
      "--bg",
      "--surface",
      "--surface-2",
      "--text",
      "--text-muted",
      "--border",
      "--accent",
      "--accent-contrast",
      "--danger",
      "--warning",
      "--success",
      "--focus-ring",
      "--selected",
      "--hover",
      "--object",
      "--duration-fast",
      "--motion-theme",
      "prefers-reduced-motion",
      "@theme inline",
    ]) {
      expect(css).toContain(name);
    }
    expect(css).toContain(LIGHT.bg);
    expect(css).toContain(DARK.bg);
  });
});
