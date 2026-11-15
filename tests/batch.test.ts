import { describe, expect, it } from "vitest";

import { batchEligible, batchGroups, parseRaiseBrief, validateBatchKey } from "../contract";

const waiting = "Waiting on you";
const low = {
  id: "1",
  item: "A",
  status: waiting,
  project: "Ops",
  doorType: "two_way" as const,
  costOfDelay: "low" as const,
  needsSplit: false,
};

describe("batch mode", () => {
  it("rejects a non-string batch_key", () => {
    expect(validateBatchKey(1).ok).toBe(false);
    expect(validateBatchKey("copy-tweaks").ok).toBe(true);
    expect(parseRaiseBrief({ title: "x", batch_key: 9 }).ok).toBe(false);
  });

  it("excludes one-way, medium, split, and expired revisits", () => {
    expect(batchEligible({ ...low, doorType: "one_way" }, waiting)).toBe(false);
    expect(batchEligible({ ...low, costOfDelay: "medium" }, waiting)).toBe(false);
    expect(batchEligible({ ...low, needsSplit: true }, waiting)).toBe(false);
    expect(batchEligible({ ...low, revisitState: "expired" }, waiting)).toBe(false);
    expect(batchEligible(low, waiting)).toBe(true);
  });

  it("groups by batch_key then area, and hides singles", () => {
    const rows = [
      { ...low, id: "a" },
      { ...low, id: "b", item: "B" },
      { ...low, id: "c", item: "C", project: "Solo" },
    ];
    const groups = batchGroups(rows, waiting);
    expect(groups).toHaveLength(1);
    expect(groups[0].rows.map((r) => r.id)).toEqual(["a", "b"]);
  });
});
