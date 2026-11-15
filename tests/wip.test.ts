import { describe, expect, it } from "vitest";

import { doingCount, findDoingColumn, findReadyColumn, parseWipEnforce, parseWipLimit, wipMoveCheck } from "../contract";

const columns = [
  { label: "Backlog", status: "Backlog" },
  { label: "To do", status: "To do" },
  { label: "In progress", status: "In progress" },
  { label: "Done", status: "Done" },
];

describe("board WIP", () => {
  it("defaults the cap to 3 and enforce to confirm", () => {
    expect(parseWipLimit({})).toBe(3);
    expect(parseWipEnforce({})).toBe("confirm");
    expect(parseWipEnforce({ BOARD_WIP_ENFORCE: "block" })).toBe("block");
  });

  it("finds doing and ready columns by label", () => {
    expect(findDoingColumn(columns)?.label).toBe("In progress");
    expect(findReadyColumn(columns)?.label).toBe("To do");
  });

  it("flags a fourth move into doing", () => {
    const doing = findDoingColumn(columns);
    const tasks = [
      { id: "a", status: "In progress" },
      { id: "b", status: "In progress" },
      { id: "c", status: "In progress" },
      { id: "d", status: "To do" },
    ];
    expect(doingCount(tasks, doing)).toBe(3);
    const check = wipMoveCheck(tasks, "d", "In progress", doing, {});
    expect(check.over).toBe(true);
    expect(check.nextCount).toBe(4);
    expect(wipMoveCheck(tasks, "d", "In progress", doing, { BOARD_WIP_LIMIT: "5" }).over).toBe(false);
  });
});
