import { describe, expect, it } from "vitest";

import {
  chatSuggestClose,
  detectChatApp,
  findChatByNormalizedUrl,
  normalizeChatUrl,
  parseAddChat,
  parseChatRevisitDays,
  parseSessionChatCap,
  sessionOverdueChats,
  type ChatPointer,
} from "../contract";

function pointer(partial: Partial<ChatPointer>): ChatPointer {
  return {
    id: partial.id ?? "c1",
    url: partial.url ?? "https://claude.ai/chat/abc",
    normalizedUrl: partial.normalizedUrl ?? "https://claude.ai/chat/abc",
    app: partial.app ?? "claude",
    title: partial.title ?? "Claude",
    nextStep: partial.nextStep ?? "Finish the outline",
    comeBackBy: partial.comeBackBy ?? "2026-11-10",
    status: partial.status ?? "open",
    ephemeral: false,
    note: null,
    linkKind: "private",
    linkDead: false,
    convertedToType: null,
    convertedToId: null,
    missedCount: partial.missedCount ?? 0,
    createdAt: partial.createdAt ?? "2026-11-01T00:00:00.000Z",
    lastUpdated: partial.lastUpdated ?? "2026-11-01T00:00:00.000Z",
  };
}

describe("chat pointers (spec 11)", () => {
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

  it("requires next_step and url or app", () => {
    expect(parseAddChat({ url: "https://claude.ai/chat/1" }, { today: "2026-11-15" }).ok).toBe(false);
    expect(parseAddChat({ next_step: "Resume the draft", url: "https://claude.ai/chat/1" }, { today: "2026-11-15" }).ok).toBe(true);
    expect(parseAddChat({ next_step: "Local session", app: "cursor" }, { today: "2026-11-15" }).ok).toBe(true);
  });

  it("returns an existing pointer for a duplicate normalized url", () => {
    const existing = pointer({});
    expect(findChatByNormalizedUrl([existing], "https://claude.ai/chat/abc")?.id).toBe("c1");
  });

  it("caps overdue session chats at 2, oldest first, and never auto-closes", () => {
    const chats = [
      pointer({ id: "a", comeBackBy: "2026-11-10" }),
      pointer({ id: "b", comeBackBy: "2026-11-12" }),
      pointer({ id: "c", comeBackBy: "2026-11-08" }),
      pointer({ id: "d", comeBackBy: "2026-11-20", status: "closed" }),
    ];
    expect(sessionOverdueChats(chats, "2026-11-15", 2).map((c) => c.id)).toEqual(["c", "a"]);
    expect(chatSuggestClose(pointer({ missedCount: 2 }), "2026-11-15")).toBe(true);
    expect(chatSuggestClose(pointer({ missedCount: 0, createdAt: "2026-11-10" }), "2026-11-15", 14)).toBe(false);
  });
});
