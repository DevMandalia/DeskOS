import { describe, expect, it } from "vitest";

import {
  agentTaggedTimeoutFields,
  parseTimeoutDefaults,
  timeoutClassOn,
  timeoutGateReason,
  mayApplyTimeouts,
  timeoutLiveAllowed,
  timeoutNoticeTomorrow,
  timeoutParkRevisitAt,
  timeoutReadyToApply,
} from "../contract";

const waiting = "Waiting on you";
const tagged = {
  status: waiting,
  doorType: "two_way" as const,
  costOfDelay: "low" as const,
  deadline: "2026-11-14",
  defaultIfNoAnswer: { choice: "Approve" as const, note: "Renew" },
  needsSplit: false,
  agentTimeoutTagged: true,
};

describe("timeout defaults", () => {
  it("is off unless TIMEOUT_DEFAULTS=two_way+low", () => {
    expect(parseTimeoutDefaults({})).toBe("off");
    expect(timeoutClassOn({})).toBe(false);
    expect(timeoutClassOn({ TIMEOUT_DEFAULTS: "two_way+low" })).toBe(true);
    expect(timeoutLiveAllowed({})).toBe(false);
    expect(timeoutLiveAllowed({ TIMEOUT_DEFAULTS_LIVE: "1" })).toBe(true);
    expect(mayApplyTimeouts({ TIMEOUT_DEFAULTS: "two_way+low" })).toBe(true);
    expect(mayApplyTimeouts({ TIMEOUT_DEFAULTS: "two_way+low", DECISION_SOURCE: "notion" })).toBe(false);
    expect(
      mayApplyTimeouts({
        TIMEOUT_DEFAULTS: "two_way+low",
        DECISION_SOURCE: "notion",
        TIMEOUT_DEFAULTS_LIVE: "1",
      }),
    ).toBe(true);
  });

  it("never applies a one-way item even with a default and a passed deadline", () => {
    const row = { ...tagged, doorType: "one_way" as const };
    expect(timeoutGateReason(row, "2026-11-15", waiting, { classOn: true })).toBe("door");
    expect(timeoutReadyToApply(row, "2026-11-15", waiting, { classOn: true })).toBe(false);
  });

  it("requires the class on, agent tags, and overdue deadline", () => {
    expect(timeoutReadyToApply(tagged, "2026-11-15", waiting, { classOn: false })).toBe(false);
    expect(timeoutReadyToApply(tagged, "2026-11-15", waiting, { classOn: true })).toBe(true);
    expect(timeoutNoticeTomorrow({ ...tagged, deadline: "2026-11-15" }, "2026-11-15", waiting, { classOn: true })).toBe(
      true,
    );
    expect(timeoutReadyToApply({ ...tagged, deadline: "2026-11-15" }, "2026-11-15", waiting, { classOn: true })).toBe(
      false,
    );
  });

  it("skips needs-split, untagged, and missing cost", () => {
    expect(timeoutReadyToApply({ ...tagged, needsSplit: true }, "2026-11-15", waiting, { classOn: true })).toBe(false);
    expect(timeoutReadyToApply({ ...tagged, agentTimeoutTagged: false }, "2026-11-15", waiting, { classOn: true })).toBe(
      false,
    );
    expect(timeoutReadyToApply({ ...tagged, costOfDelay: null }, "2026-11-15", waiting, { classOn: true })).toBe(false);
  });

  it("tags agent-supplied two-way low default+deadline", () => {
    expect(agentTaggedTimeoutFields(tagged)).toBe(true);
    expect(agentTaggedTimeoutFields({ ...tagged, doorType: null })).toBe(false);
  });

  it("parks with apply-day + 14", () => {
    expect(timeoutParkRevisitAt("2026-11-15", 14)).toBe("2026-11-29");
  });
});
