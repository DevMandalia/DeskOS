import { describe, expect, it } from "vitest";

import {
  assessSplit,
  classifyExisting,
  compareWaiting,
  expireParkIfNeeded,
  parseBriefJson,
  parseQueueSort,
  parseRaiseBrief,
  resolveQueueSort,
} from "../contract";
import { parseRaise } from "@/lib/raise";

describe("raise_decision", () => {
  it("lets a title-only raise through (old agents)", () => {
    const parsed = parseRaise({ title: "Renew the staging cert?" });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.item).toBe("Renew the staging cert?");
      expect(parsed.brief.needsSplit).toBe(false);
    }
  });

  it("accepts a bundled raise and flags needsSplit", () => {
    const parsed = parseRaise({
      title: "Content OS proposal: open decisions",
      decision_needed: "Pick pillars? Cadence? Format?",
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.brief.needsSplit).toBe(true);
      expect(parsed.brief.splitReason).toBe("multiple_questions");
    }
  });

  it("accepts a reading task and flags review_task", () => {
    const parsed = parseRaise({
      title: "Rituals planning read",
      decision_needed: "Read the rituals planning notes and share input.",
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.brief.needsSplit).toBe(true);
      expect(parsed.brief.splitReason).toBe("review_task");
    }
  });

  it("trusts needs_split false and skips heuristics", () => {
    const parsed = parseRaise({
      title: "Pick pillars? Cadence?",
      decision_needed: "Pick pillars? Cadence?",
      needs_split: false,
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.brief.needsSplit).toBe(false);
  });

  it("returns 400 for invalid present enums", () => {
    const parsed = parseRaiseBrief({ title: "x", door_type: "two-way", cost_of_delay: "Medium" });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.field).toBe("door_type");
    const cost = parseRaiseBrief({ title: "x", cost_of_delay: "critical" });
    expect(cost.ok).toBe(false);
  });

  it("returns 400 for short options", () => {
    const parsed = parseRaise({ title: "Ship?", options: ["Only one"] });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.field).toBe("options");
  });

  it("stores optional brief fields", () => {
    const parsed = parseRaise({
      title: "Renew?",
      decision_needed: "Buy another year?",
      options: ["Renew", "Lapse"],
      recommendation: "Renew",
      door_type: "two_way",
      cost_of_delay: "low",
      deadline: "2026-12-01",
      default_if_no_answer: { choice: "Approve", note: "Renew" },
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.brief.doorType).toBe("two_way");
      expect(parsed.brief.costOfDelay).toBe("low");
      expect(parsed.brief.options).toEqual(["Renew", "Lapse"]);
      expect(parsed.brief.defaultIfNoAnswer).toEqual({ choice: "Approve", note: "Renew" });
      expect(parsed.brief.needsSplit).toBe(false);
    }
  });
});

describe("classifyExisting (proposal only, never writes)", () => {
  it("flags Content OS as a bundle and Rituals as a task", () => {
    expect(
      classifyExisting({
        title: "Content OS proposal: open decisions",
        decisionNeeded: "Pick 5-7 topic pillars; posts per week; drop format?",
      }),
    ).toBe("bundle");
    expect(
      classifyExisting({
        title: "Rituals planning read",
        decisionNeeded: "Read the rituals planning notes and share input.",
      }),
    ).toBe("task");
    expect(classifyExisting({ title: "OK to clean up tug4.tar?", decisionNeeded: "OK to clean up tug4.tar?" })).toBe(
      "ok",
    );
  });
});

describe("assessSplit", () => {
  it("does not treat a single question with options as a bundle", () => {
    const result = assessSplit({
      item: "Renew domain?",
      decisionNeeded: "Buy another year?",
      hasOptions: true,
    });
    expect(result.needsSplit).toBe(false);
  });

  it("does not flag a complete raise just because title, needed, and next step are three lines", () => {
    const result = assessSplit({
      item: "Renew the staging cert?",
      decisionNeeded: "Buy another year at $14?",
      nextStep: "Ops will pay the registrar if you approve.",
    });
    expect(result.needsSplit).toBe(false);
  });
});

describe("QUEUE_SORT", () => {
  it("defaults to stakes unless QUEUE_SORT is set", () => {
    expect(resolveQueueSort({})).toBe("stakes");
    expect(resolveQueueSort({}, "age")).toBe("age");
    expect(resolveQueueSort({ QUEUE_SORT: "age" }, "stakes")).toBe("age");
  });

  it("GET ?sort= is opt-in; omitted keeps store order", () => {
    expect(parseQueueSort(null)).toBeNull();
    expect(parseQueueSort("")).toBeNull();
    expect(parseQueueSort("stakes")).toBe("stakes");
    expect(parseQueueSort("age")).toBe("age");
    expect(parseQueueSort("nope")).toBeNull();
  });
});

describe("park sunset", () => {
  it("does not reclassify parked rows without a revisit date", () => {
    expect(
      expireParkIfNeeded({ status: "Parked", revisitAt: null }, "2026-11-15", "Waiting on you", "Parked"),
    ).toBeNull();
  });

  it("expires a scheduled park whose date is before today", () => {
    expect(
      expireParkIfNeeded(
        { status: "Parked", revisitAt: "2026-11-01", revisitState: "scheduled" },
        "2026-11-15",
        "Waiting on you",
        "Parked",
      ),
    ).toEqual({ status: "Waiting on you", revisitState: "expired" });
  });
});

describe("stakes formula", () => {
  it("puts overdue ahead of high cost", () => {
    const overdue = { item: "old", lastUpdated: "2026-11-12", costOfDelay: "low" as const, deadline: "2026-11-01" };
    const high = { item: "high", lastUpdated: "2026-11-01", costOfDelay: "high" as const, deadline: "2026-12-01" };
    expect(compareWaiting(overdue, high, "stakes", "2026-11-15")).toBeLessThan(0);
  });

  it("treats missing cost as medium", () => {
    const missing = { item: "m", lastUpdated: "2026-11-10", costOfDelay: null };
    const high = { item: "h", lastUpdated: "2026-11-10", costOfDelay: "high" as const };
    expect(compareWaiting(high, missing, "stakes", "2026-11-15")).toBeLessThan(0);
  });
});

describe("brief json", () => {
  it("round-trips optional fields including old door key", () => {
    const parsed = parseBriefJson(
      JSON.stringify({ door: "one_way", costOfDelay: "high", deadline: "2026-11-20" }),
    );
    expect(parsed.doorType).toBe("one_way");
    expect(parsed.costOfDelay).toBe("high");
    expect(parsed.deadline).toBe("2026-11-20");
  });
});
