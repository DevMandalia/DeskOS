import { describe, expect, it } from "vitest";

import {
  applyPatch,
  buildLanes,
  columnOf,
  dueLabel,
  parseBoardColumns,
  parseQuickAdd,
  quickAddStatus,
  resolveColumns,
} from "@/lib/board";
import type { Task } from "@/lib/tasks/types";

function task(over: Partial<Task>): Task {
  return {
    id: over.id ?? "t1",
    url: "",
    title: "A task",
    status: "Backlog",
    area: null,
    areaColor: null,
    due: null,
    priority: null,
    owner: null,
    rank: null,
    lastEdited: "2026-11-14T00:00:00.000Z",
    raisedBy: null,
    ...over,
  };
}

describe("resolveColumns", () => {
  it("uses one column per store status when nothing is configured", () => {
    const cols = resolveColumns(["Ready", "Doing", "Done"]);
    expect(cols.map((c) => [c.key, c.label, c.status])).toEqual([
      ["ready", "Ready", "Ready"],
      ["doing", "Doing", "Doing"],
      ["done", "Done", "Done"],
    ]);
  });

  it("maps configured labels onto the store's statuses", () => {
    const configured = parseBoardColumns("Backlog,To do,In progress");
    const cols = resolveColumns(["Backlog", "In progress"], configured);
    expect(cols.map((c) => [c.label, c.status])).toEqual([
      ["Backlog", "Backlog"],
      ["To do", null],
      ["In progress", "In progress"],
    ]);
  });
});

describe("columnOf / quickAddStatus", () => {
  const cols = resolveColumns(["Backlog", "In progress", "Done"]);
  it("puts unknown or empty statuses in the first column", () => {
    expect(columnOf({ status: null }, cols)).toBe("backlog");
    expect(columnOf({ status: "Someday" }, cols)).toBe("backlog");
    expect(columnOf({ status: "in progress" }, cols)).toBe("in-progress");
  });
  it("quick-add uses the first writable column", () => {
    expect(quickAddStatus(cols)).toBe("Backlog");
  });
});

describe("parseQuickAdd / dueLabel / applyPatch", () => {
  it("reads an #area hashtag", () => {
    expect(parseQuickAdd("Ship it #Ops", ["Ops", "Product"])).toEqual({
      title: "Ship it",
      area: "Ops",
    });
  });
  it("marks overdue dues", () => {
    expect(dueLabel("2026-11-01", "2026-11-10")?.overdue).toBe(true);
    expect(dueLabel("2026-11-10", "2026-11-10")?.text).toBe("Due today");
  });
  it("patches title and status", () => {
    expect(applyPatch(task({}), { title: "B", status: "Done" }).title).toBe("B");
  });
});

describe("buildLanes", () => {
  const cols = resolveColumns(["Backlog", "Done"]);
  it("groups tasks by status", () => {
    const lanes = buildLanes(
      [task({ id: "a", status: "Backlog" }), task({ id: "b", status: "Done" })],
      cols,
    );
    expect(lanes[0].tasks.map((t) => t.id)).toEqual(["a"]);
    expect(lanes[1].tasks.map((t) => t.id)).toEqual(["b"]);
  });
});
