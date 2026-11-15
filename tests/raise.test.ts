import { describe, expect, it } from "vitest";

import { assessRaise, classifyExisting, parseBriefJson, resolveQueueSort } from "../contract";
import { parseRaise } from "@/lib/raise";

describe("raise_decision gate", () => {
  it("lets a title-only raise through (old agents)", () => {
    const parsed = parseRaise({ title: "Renew the staging cert?" });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.item).toBe("Renew the staging cert?");
  });

  it("rejects a bundled raise with 422", () => {
    const parsed = parseRaise({
      title: "Content OS proposal: open decisions",
      decision_needed: "Pick pillars? Cadence? Format?",
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.status).toBe(422);
      expect(parsed.code).toBe("not_one_decision");
    }
  });

  it("rejects a reading task with 422", () => {
    const parsed = parseRaise({
      title: "Rituals planning read",
      decision_needed: "Read the rituals planning notes and share input.",
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.status).toBe(422);
      expect(parsed.code).toBe("not_a_decision");
    }
  });

  it("rejects kind=task", () => {
    const parsed = parseRaise({ title: "File the invoice", kind: "task" });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.code).toBe("kind_not_decision");
  });

  it("requires the brief only when DESK_BRIEF_REQUIRED=1", () => {
    const optional = parseRaise({ title: "Ship the sample?" });
    expect(optional.ok).toBe(true);
    const required = parseRaise({ title: "Ship the sample?" }, { DESK_BRIEF_REQUIRED: "1" });
    expect(required.ok).toBe(false);
    if (!required.ok) {
      expect(required.status).toBe(400);
      expect(required.code).toBe("brief_incomplete");
      expect(required.missing).toContain("options");
    }
  });

  it("stores optional brief fields", () => {
    const parsed = parseRaise({
      title: "Renew?",
      decision_needed: "Buy another year?",
      options: ["Renew", "Lapse"],
      recommendation: "Renew",
      door: "two_way",
      cost_of_delay: "low",
      deadline: "2026-12-01",
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.brief.door).toBe("two_way");
      expect(parsed.brief.costOfDelay).toBe("low");
      expect(parsed.brief.options).toEqual(["Renew", "Lapse"]);
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

describe("assessRaise kind", () => {
  it("treats kind=bundle as not_one_decision", () => {
    const fail = assessRaise({ title: "Program", kind: "bundle" });
    expect(fail?.code).toBe("not_one_decision");
  });
});

describe("QUEUE_SORT", () => {
  it("defaults demo to stakes and live to age", () => {
    expect(resolveQueueSort({ DESK_DEMO: "1" })).toBe("stakes");
    expect(resolveQueueSort({})).toBe("age");
    expect(resolveQueueSort({ QUEUE_SORT: "age", DESK_DEMO: "1" })).toBe("age");
  });
});

describe("brief json", () => {
  it("round-trips optional fields", () => {
    const parsed = parseBriefJson(
      JSON.stringify({ door: "one_way", costOfDelay: "high", deadline: "2026-11-20" }),
    );
    expect(parsed.door).toBe("one_way");
    expect(parsed.costOfDelay).toBe("high");
    expect(parsed.deadline).toBe("2026-11-20");
  });
});
