import { describe, expect, it } from "vitest";

import { contrastRatio, DARK, LIGHT, THEME_BOOTSTRAP_SCRIPT } from "../src/lib/theme";

describe("DeskOS contrast (WCAG AA)", () => {
  it("keeps light text, chips, and buttons at or above 4.5:1", () => {
    expect(contrastRatio(LIGHT.text, LIGHT.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(LIGHT.secondary, LIGHT.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(LIGHT.teal, LIGHT.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(LIGHT.orange, LIGHT.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(LIGHT.onFill, LIGHT.teal)).toBeGreaterThanOrEqual(4.5);
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

  it("boots from localStorage before paint", () => {
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("localStorage");
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("prefers-color-scheme");
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("data-theme");
  });
});
