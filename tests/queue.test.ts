import { describe, expect, it } from "vitest";

import {
  ageDays,
  cardAge,
  deskOrder,
  displayTitle,
  formatAge,
  shortDate,
  waitingAreaCounts,
  waitingQueue,
} from "@/lib/queue";
import type { BriefRow } from "@/lib/types";

function row(partial: Partial<BriefRow>): BriefRow {
  return {
    id: partial.id ?? Math.random().toString(16).slice(2),
    url: "",
    item: "Item",
    project: "Area",
    status: "Waiting on you",
    owner: "Acme Ops",
    ownerColor: null,
    decisionNeeded: null,
    nextStep: null,
    source: null,
    reply: null,
    lastUpdated: "2026-11-10",
    raisedBy: null,
    lastChoice: null,
    ...partial,
  };
}

describe("displayTitle", () => {
  it("returns the item as-is", () => {
    expect(displayTitle("Example: renew domain?")).toBe("Example: renew domain?");
    expect(displayTitle("Ship the November changelog")).toBe("Ship the November changelog");
  });
});

describe("ageDays / formatAge", () => {
  const now = new Date("2026-11-13T23:30:00Z");

  it("counts calendar days in the desk timezone for bare dates", () => {
    expect(ageDays("2026-11-09", now)).toBe(4);
    expect(ageDays("2026-11-13", now)).toBe(0);
    expect(ageDays("2026-10-31", now)).toBe(13);
  });

  it("uses the zone date of timestamps, not UTC", () => {
    expect(ageDays("2026-11-13T06:00:00Z", now)).toBe(1);
    expect(ageDays("2026-11-13T22:00:00-08:00", new Date("2026-11-14T06:30:00Z"))).toBe(0);
  });

  it("never goes negative and handles missing dates", () => {
    expect(ageDays("2026-11-20", now)).toBe(0);
    expect(ageDays(null, now)).toBeNull();
    expect(ageDays("not a date", now)).toBeNull();
  });

  it("formats", () => {
    expect(formatAge(4)).toBe("4d");
    expect(formatAge(0)).toBe("today");
    expect(formatAge(null)).toBe("");
  });

  it("short dates", () => {
    expect(shortDate("2026-11-09", now)).toBe("Nov 9");
    expect(shortDate("2025-12-30", now)).toBe("Dec 30, 2025");
    expect(shortDate(null, now)).toBe("");
  });
});

describe("waitingQueue / deskOrder / counts", () => {
  const rows = [
    row({ id: "new", item: "B new", lastUpdated: "2026-11-12" }),
    row({ id: "old", item: "A old", lastUpdated: "2026-11-03" }),
    row({ id: "nodate", item: "C none", lastUpdated: null }),
    row({ id: "fly", item: "Flying", status: "In flight", project: "Zed" }),
    row({ id: "park", item: "Parked", status: "Parked", project: "Alpha" }),
  ];

  it("queues waiting rows oldest first, undated last", () => {
    expect(waitingQueue(rows).map((r) => r.id)).toEqual(["old", "new", "nodate"]);
  });

  it("orders the desk queue first, then the rest by area", () => {
    expect(deskOrder(rows).map((r) => r.id)).toEqual(["old", "new", "nodate", "park", "fly"]);
  });

  it("counts only waiting rows per area", () => {
    expect(waitingAreaCounts(rows)).toEqual([
      { area: "Area", count: 3 },
      { area: "Alpha", count: 0 },
      { area: "Zed", count: 0 },
    ]);
  });
});

describe("cardAge", () => {
  const now = new Date("2026-11-14T20:00:00-08:00");
  it("says how long a row has waited, or when it was updated", () => {
    expect(cardAge(row({ lastUpdated: "2026-11-03" }), now)).toBe("Waiting 11 days");
    expect(cardAge(row({ lastUpdated: "2026-11-13" }), now)).toBe("Waiting 1 day");
    expect(cardAge(row({ lastUpdated: "2026-11-14" }), now)).toBe("Waiting since today");
    expect(cardAge(row({ status: "In flight", lastUpdated: "2026-11-10" }), now)).toBe("Updated 4 days ago");
    expect(cardAge(row({ lastUpdated: null }), now)).toBe("");
  });
});
