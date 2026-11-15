import { describe, expect, it } from "vitest";

import {
  buildNotifyPayload,
  formatIsoPT,
  formatReply,
  isDuplicateReply,
  normalizeOffset,
  prependReply,
  statusForChoice,
} from "../src/lib/decide";

describe("statusForChoice", () => {
  it("maps Approve to In flight", () => {
    expect(statusForChoice("Approve")).toBe("In flight");
  });

  it("maps Decline to Parked", () => {
    expect(statusForChoice("Decline")).toBe("Parked");
  });

  it("maps Discuss to Waiting on you", () => {
    expect(statusForChoice("Discuss")).toBe("Waiting on you");
  });
});

describe("formatReply", () => {
  it("formats a note with ISO time in the desk timezone", () => {
    const at = new Date("2026-11-13T18:18:22.000Z");
    const line = formatReply("Approve", "Keep all five", at);
    expect(line.startsWith("Approve — Keep all five (via Decision Desk, ")).toBe(true);
    expect(line.endsWith(")")).toBe(true);
    expect(line).toContain("2026-11-13T10:18:22-08:00");
  });

  it("keeps the em dash when the note is empty", () => {
    const at = new Date("2026-11-13T18:18:22.000Z");
    expect(formatReply("Decline", "  ", at)).toBe(
      "Decline — (via Decision Desk, 2026-11-13T10:18:22-08:00)",
    );
  });
});

describe("prependReply", () => {
  it("returns the new line when the field is empty", () => {
    expect(prependReply(null, "Approve — (via Decision Desk, t)")).toBe(
      "Approve — (via Decision Desk, t)",
    );
  });

  it("puts the new line above existing text", () => {
    expect(prependReply("old note", "Discuss — hold (via Decision Desk, t)")).toBe(
      "Discuss — hold (via Decision Desk, t)\nold note",
    );
  });
});

describe("isDuplicateReply", () => {
  it("treats the same choice and note within two minutes as a double-click", () => {
    const existing = "Approve — keep (via Decision Desk, 2026-11-13T10:18:22-08:00)";
    const now = Date.parse("2026-11-13T18:19:00.000Z");
    expect(isDuplicateReply(existing, "Approve", "keep", now)).toBe(true);
  });

  it("allows a different choice", () => {
    const existing = "Approve — keep (via Decision Desk, 2026-11-13T10:18:22-08:00)";
    expect(isDuplicateReply(existing, "Decline", "keep")).toBe(false);
  });
});

describe("normalizeOffset", () => {
  it("pads GMT-8 to -08:00", () => {
    expect(normalizeOffset("GMT-8")).toBe("-08:00");
  });
});

describe("buildNotifyPayload", () => {
  it("includes the raising agent so the lead can be notified", () => {
    const payload = buildNotifyPayload({
      row_id: "abc",
      url: "https://desk.example/d/abc",
      item: "Logo",
      project: "Marketing",
      owner: "Acme Ops",
      choice: "Approve",
      note: "2d",
      at: "2026-11-13T10:18:22-08:00",
    });
    expect(payload.owner).toBe("Acme Ops");
    expect(payload.project).toBe("Marketing");
  });

  it('is typed "desk_decision" and keeps every existing field', () => {
    const input = {
      row_id: "abc",
      url: "https://desk.example/d/abc",
      item: "Logo",
      project: null,
      owner: null,
      choice: "Discuss" as const,
      note: "",
      at: "2026-11-14T21:30:00-08:00",
    };
    const payload = buildNotifyPayload(input);
    expect(payload).toEqual({ type: "desk_decision", agent_id: null, ...input });
    expect(JSON.parse(JSON.stringify(payload)).type).toBe("desk_decision");
  });
});

describe("formatIsoPT", () => {
  it("uses the Pacific offset, not UTC", () => {
    expect(formatIsoPT(new Date("2026-11-13T18:18:22.000Z"))).toBe("2026-11-13T10:18:22-08:00");
  });
});
