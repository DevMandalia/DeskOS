import { describe, expect, it } from "vitest";

import { countsTowardSession, doneThisWeekCount, mondayOfWeek, parseSessionCap, sessionSentence } from "../contract";

describe("daily session", () => {
  it("defaults the cap to 5 and does not count Discuss or Keep parked", () => {
    expect(parseSessionCap({})).toBe(5);
    expect(countsTowardSession({ choice: "Approve" })).toBe(true);
    expect(countsTowardSession({ choice: "Decline" })).toBe(true);
    expect(countsTowardSession({ choice: "Park" })).toBe(true);
    expect(countsTowardSession({ choice: "Park", keepParked: true })).toBe(false);
    expect(countsTowardSession({ choice: "Discuss", discuss: true })).toBe(false);
    expect(countsTowardSession({ choice: "Reopen", reopen: true })).toBe(false);
  });

  it("writes unscored sentences including timeout", () => {
    expect(sessionSentence({ choice: "Approve", item: "Renew the cert" })).toBe("Approved ‘Renew the cert’.");
    expect(sessionSentence({ choice: "Approve", item: "Copy tweak", appliedBy: "timeout" })).toBe(
      "Approved ‘Copy tweak’ (default on timeout).",
    );
    expect(sessionSentence({ choice: "Park", item: "Vendor switch", revisitAt: "2026-11-29" })).toBe(
      "Parked ‘Vendor switch’ until 29 Nov.",
    );
  });

  it("counts Done this week from Monday, excluding Declined", () => {
    expect(mondayOfWeek("2026-11-15")).toBe("2026-11-09");
    expect(
      doneThisWeekCount(
        [
          { status: "Done", lastUpdated: "2026-11-10T12:00:00-08:00" },
          { status: "Declined", lastUpdated: "2026-11-14T12:00:00-08:00" },
          { status: "Done", lastUpdated: "2026-11-01T12:00:00-08:00" },
        ],
        "2026-11-15",
        "Done",
        "America/Los_Angeles",
      ),
    ).toBe(1);
  });
});
