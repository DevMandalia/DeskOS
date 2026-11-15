import { describe, expect, it } from "vitest";

import { reviewDecisionBucket, reviewPage, sortReviewItems } from "../contract";

describe("weekly review", () => {
  it("surfaces needs-split before stale waiting", () => {
    const split = reviewDecisionBucket(
      { id: "s", item: "Bundle", status: "Waiting on you", needsSplit: true, lastUpdated: "2026-10-01" },
      "2026-11-15",
      "Waiting on you",
      14,
    );
    const stale = reviewDecisionBucket(
      { id: "w", item: "Old", status: "Waiting on you", lastUpdated: "2026-10-01" },
      "2026-11-15",
      "Waiting on you",
      14,
    );
    expect(split?.kind).toBe("split");
    expect(stale?.kind).toBe("stale_waiting");
    expect(sortReviewItems([stale!, split!]).map((i) => i.kind)).toEqual(["split", "stale_waiting"]);
  });

  it("asks at most 5", () => {
    const items = Array.from({ length: 8 }, (_, i) => ({
      id: String(i),
      kind: "stale_waiting" as const,
      title: `n${i}`,
      reason: "stale",
      type: "decision" as const,
    }));
    expect(reviewPage(items).length).toBe(5);
  });
});
