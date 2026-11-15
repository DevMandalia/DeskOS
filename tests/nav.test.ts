import { describe, expect, it } from "vitest";

import {
  buildHome,
  buildNav,
  decisionHref,
  deskHref,
  legacyListHref,
  parseView,
  scopeRows,
  viewFromSlug,
} from "@/lib/nav";
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

const rows = [
  row({ id: "w1", project: "A", lastUpdated: "2026-11-09" }),
  row({ id: "w2", project: "B", lastUpdated: "2026-11-01" }),
  row({ id: "f1", project: "A", status: "In flight" }),
  row({ id: "p1", project: "B", status: "Parked" }),
  row({ id: "d1", project: "A", status: "Done" }),
];

describe("parseView", () => {
  it("accepts known views only", () => {
    expect(parseView("flight")).toBe("flight");
    expect(parseView("all")).toBe("all");
    expect(parseView("nope")).toBe("waiting");
    expect(parseView(undefined)).toBe("waiting");
  });
});

describe("hrefs", () => {
  it("builds desk and decision URLs that keep the scope", () => {
    expect(deskHref({})).toBe("/waiting");
    expect(deskHref({ view: "flight", area: "A & B" })).toBe("/in-flight?area=A+%26+B");
    expect(deskHref({ includeDone: true })).toBe("/waiting?done=1");
    expect(deskHref({ view: "done", includeDone: true })).toBe("/done");
    expect(deskHref({ view: "waiting", area: "A" })).toBe("/waiting?area=A");
    expect(deskHref({ view: "all" })).toBe("/all");
    expect(decisionHref("x", {})).toBe("/d/x");
    expect(decisionHref("x", { view: "waiting", area: "A" })).toBe("/d/x?area=A");
    expect(decisionHref("x", { view: "flight" })).toBe("/d/x?view=flight");
  });
});

describe("scopeRows", () => {
  it("hides Done unless asked, and filters by view and area", () => {
    const ids = (list: BriefRow[]) => list.map((r) => r.id);
    expect(ids(scopeRows(rows, { area: null, view: "waiting", includeDone: false }))).toEqual([
      "w1",
      "w2",
    ]);
    expect(ids(scopeRows(rows, { area: null, view: "all", includeDone: false }))).toEqual([
      "w1",
      "w2",
      "f1",
      "p1",
    ]);
    expect(ids(scopeRows(rows, { area: null, view: "done", includeDone: false }))).toEqual(["d1"]);
    expect(ids(scopeRows(rows, { area: "A", view: "waiting", includeDone: false }))).toEqual(["w1"]);
  });
});

describe("buildNav", () => {
  it("counts views and waiting-per-area, and lists the queue oldest first", () => {
    const nav = buildNav(rows, { area: null, view: "waiting", includeDone: false });
    expect(nav.views.map((v) => [v.label, v.count, v.active, v.href])).toEqual([
      ["Waiting on you", 2, true, "/waiting"],
      ["In flight", 1, false, "/in-flight"],
      ["Parked", 1, false, "/parked"],
      ["Done", 1, false, "/done"],
      ["All open", 4, false, "/all"],
    ]);
    expect(nav.areas.map((a) => [a.area, a.count])).toEqual([
      ["A", 1],
      ["B", 1],
    ]);
    expect(nav.totalWaiting).toBe(2);
    expect(nav.queue.map((r) => r.id)).toEqual(["w2", "w1"]);
  });

  it("scopes view counts and the queue to the selected area", () => {
    const nav = buildNav(rows, { area: "A", view: "flight", includeDone: false });
    expect(nav.views.find((v) => v.key === "flight")).toMatchObject({ count: 1, active: true });
    expect(nav.areas.find((a) => a.area === "A")).toMatchObject({
      active: true,
      href: "/in-flight?area=A",
    });
    expect(nav.queue.map((r) => r.id)).toEqual(["w1"]);
  });
});

describe("view routes", () => {
  it("gives every view its own route and maps old desk links onto them", () => {
    expect(deskHref({})).toBe("/waiting");
    expect(deskHref({ view: "flight", area: "A & B" })).toBe("/in-flight?area=A+%26+B");
    expect(deskHref({ view: "done", includeDone: true })).toBe("/done");
    expect(deskHref({ view: "all", includeDone: true })).toBe("/all?done=1");
    expect(viewFromSlug("in-flight")).toBe("flight");
    expect(viewFromSlug("d")).toBeNull();
    expect(legacyListHref({})).toBeNull();
    expect(legacyListHref({ area: "A" })).toBe("/waiting?area=A");
    expect(legacyListHref({ view: "flight" })).toBe("/in-flight");
    expect(legacyListHref({ view: "parked", area: "B", done: "1" })).toBe("/parked?area=B&done=1");
    expect(legacyListHref({ done: "1" })).toBe("/all?done=1");
  });
});

describe("buildHome", () => {
  it("counts by status and area, lists the oldest waiting and the most recent", () => {
    const home = buildHome(rows, 1);
    expect(home.counts.map((c) => [c.label, c.count, c.href])).toEqual([
      ["Waiting on you", 2, "/waiting"],
      ["In flight", 1, "/in-flight"],
      ["Parked", 1, "/parked"],
      ["Done", 1, "/done"],
    ]);
    expect(home.areas).toEqual([
      { area: "A", waiting: 1, open: 2, href: "/waiting?area=A" },
      { area: "B", waiting: 1, open: 2, href: "/waiting?area=B" },
    ]);
    expect(home.oldest.map((r) => r.id)).toEqual(["w2"]);
    expect(home.recent).toHaveLength(1);
    expect(home.totalWaiting).toBe(2);
  });
});
