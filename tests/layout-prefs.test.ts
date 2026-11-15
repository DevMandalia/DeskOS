import { describe, expect, it } from "vitest";

import {
  CHAT_PANE,
  clampWidth,
  FOCUS_KEY,
  LAYOUT_BOOTSTRAP_SCRIPT,
  NAV_PANE,
  parseCollapsed,
  parseFocus,
  parseWidth,
} from "@/lib/layout-prefs";

describe("pane widths", () => {
  it("clamps to each pane's bounds and falls back to the default", () => {
    expect(clampWidth(100, NAV_PANE)).toBe(200);
    expect(clampWidth(999, NAV_PANE)).toBe(320);
    expect(clampWidth(310.6, NAV_PANE)).toBe(311);
    expect(clampWidth(Number.NaN, CHAT_PANE)).toBe(340);
    expect(parseWidth(null, NAV_PANE)).toBe(240);
    expect(parseWidth("", CHAT_PANE)).toBe(340);
    expect(parseWidth("junk", CHAT_PANE)).toBe(340);
    expect(parseWidth("200", CHAT_PANE)).toBe(280);
    expect(parseWidth("700", CHAT_PANE)).toBe(480);
    expect(parseCollapsed("1")).toBe(true);
    expect(parseCollapsed(null)).toBe(false);
    expect(parseFocus("1")).toBe(true);
    expect(parseFocus(null)).toBe(false);
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
    expect(props.get("--nav-w")).toBe("320px");
    expect(props.get("--chat-w")).toBe("340px");
    expect(attrs.get("data-nav")).toBe("open");
    expect(attrs.get("data-chat")).toBe("collapsed");
    expect(attrs.get("data-focus")).toBe("off");
  });

  it("boot script turns focus mode on from localStorage", () => {
    const store = new Map<string, string>([[FOCUS_KEY, "1"]]);
    const attrs = new Map<string, string>();
    const fakeDocument = {
      documentElement: {
        style: { setProperty: () => undefined },
        setAttribute: (k: string, v: string) => attrs.set(k, v),
      },
    };
    const fakeStorage = { getItem: (k: string) => store.get(k) ?? null };
    new Function("document", "localStorage", LAYOUT_BOOTSTRAP_SCRIPT)(fakeDocument, fakeStorage);
    expect(attrs.get("data-focus")).toBe("on");
  });
});
