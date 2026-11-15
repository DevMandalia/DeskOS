import { describe, expect, it } from "vitest";

import { CHAT_PANE, clampWidth, LAYOUT_BOOTSTRAP_SCRIPT, NAV_PANE, parseCollapsed, parseWidth } from "@/lib/layout-prefs";

describe("pane widths", () => {
  it("clamps to each pane's bounds and falls back to the default", () => {
    expect(clampWidth(100, NAV_PANE)).toBe(200);
    expect(clampWidth(999, NAV_PANE)).toBe(420);
    expect(clampWidth(310.6, NAV_PANE)).toBe(311);
    expect(clampWidth(Number.NaN, CHAT_PANE)).toBe(380);
    expect(parseWidth(null, NAV_PANE)).toBe(248);
    expect(parseWidth("", CHAT_PANE)).toBe(380);
    expect(parseWidth("junk", CHAT_PANE)).toBe(380);
    expect(parseWidth("200", CHAT_PANE)).toBe(300);
    expect(parseWidth("700", CHAT_PANE)).toBe(640);
    expect(parseCollapsed("1")).toBe(true);
    expect(parseCollapsed(null)).toBe(false);
  });

  it("boot script applies stored widths and collapsed state to <html>", () => {
    const store = new Map<string, string>([
      ["desk-nav-width", "9999"],
      ["desk-chat-collapsed", "1"],
    ]);
    const props = new Map<string, string>();
    const attrs = new Map<string, string>();
    const fakeDocument = {
      documentElement: {
        style: { setProperty: (k: string, v: string) => props.set(k, v) },
        setAttribute: (k: string, v: string) => attrs.set(k, v),
      },
    };
    const fakeStorage = { getItem: (k: string) => store.get(k) ?? null };
    new Function("document", "localStorage", LAYOUT_BOOTSTRAP_SCRIPT)(fakeDocument, fakeStorage);
    expect(props.get("--nav-w")).toBe("420px");
    expect(props.get("--chat-w")).toBe("380px");
    expect(attrs.get("data-nav")).toBe("open");
    expect(attrs.get("data-chat")).toBe("collapsed");
  });
});
