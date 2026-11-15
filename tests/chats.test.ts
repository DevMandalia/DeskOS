import { describe, expect, it } from "vitest";

import { detectChatApp, normalizeChatUrl, parseChatRevisitDays, parseSessionChatCap } from "../contract";

describe("chat pointers (spec 11 data model)", () => {
  it("defaults come-back to 3 days and session cap to 2", () => {
    expect(parseChatRevisitDays({})).toBe(3);
    expect(parseSessionChatCap({})).toBe(2);
  });

  it("normalizes urls and does not treat every x.com path as Grok", () => {
    expect(normalizeChatUrl("https://claude.ai/chat/abc/?utm_source=x#frag")).toBe("https://claude.ai/chat/abc");
    expect(detectChatApp("https://claude.ai/chat/abc").app).toBe("claude");
    expect(detectChatApp("https://x.com/i/grok").app).toBe("grok");
    expect(detectChatApp("https://x.com/someone/status/1").app).toBe("other");
  });
});
