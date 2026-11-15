import { describe, expect, it } from "vitest";

import { agentStatsFromRows, autoApproveAllowed, parseAutoApprove } from "../contract";

describe("agent scorecard", () => {
  it("does not build learned auto-approve", () => {
    expect(parseAutoApprove()).toBe("off");
    expect(autoApproveAllowed()).toBe(false);
  });

  it("uses null approval rate when nothing is closed", () => {
    const stats = agentStatsFromRows(
      [{ raisedBy: { id: "a", name: "Ops" }, status: "Waiting on you", lastChoice: null }],
      "Waiting on you",
    );
    expect(stats[0].approval_rate).toBeNull();
    expect(stats[0].raised).toBe(1);
  });

  it("computes approval rate from Approve+Decline only", () => {
    const stats = agentStatsFromRows(
      [
        { raisedBy: { id: "a", name: "Ops" }, lastChoice: "Approve", status: "In flight" },
        { raisedBy: { id: "a", name: "Ops" }, lastChoice: "Decline", status: "Declined" },
        { raisedBy: { id: "a", name: "Ops" }, lastChoice: "Park", status: "Parked" },
      ],
      "Waiting on you",
    );
    expect(stats[0].approval_rate).toBe(0.5);
    expect(stats[0].parked).toBe(1);
  });
});
