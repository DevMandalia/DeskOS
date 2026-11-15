/** Spec 10: unscored agent scorecard. Learned auto-approve is not built. */

export type AgentStats = {
  id: string;
  name: string;
  raised: number;
  open_waiting: number;
  approved: number;
  declined: number;
  parked: number;
  approval_rate: number | null;
  median_time_to_verdict_hours: number | null;
  discuss_rate: number;
  timeout_rate: number;
  split_rate: number;
};

export function parseAutoApprove(): "off" {
  return "off";
}

export function autoApproveAllowed(): boolean {
  return false;
}

export function agentStatsFromRows(
  rows: {
    raisedBy?: { id: string; name?: string | null } | null;
    status?: string | null;
    lastChoice?: string | null;
    appliedBy?: string | null;
    needsSplit?: boolean | null;
    lastUpdated?: string | null;
  }[],
  waitingStatus: string,
): AgentStats[] {
  const by = new Map<string, typeof rows>();
  for (const row of rows) {
    const id = row.raisedBy?.id ?? "unknown";
    const list = by.get(id) ?? [];
    list.push(row);
    by.set(id, list);
  }
  return [...by.entries()].map(([id, list]) => {
    const approved = list.filter((r) => r.lastChoice === "Approve").length;
    const declined = list.filter((r) => r.lastChoice === "Decline").length;
    const parked = list.filter((r) => r.lastChoice === "Park").length;
    const closed = approved + declined;
    return {
      id,
      name: list.find((r) => r.raisedBy?.name)?.raisedBy?.name ?? id,
      raised: list.length,
      open_waiting: list.filter((r) => r.status === waitingStatus).length,
      approved,
      declined,
      parked,
      approval_rate: closed === 0 ? null : Math.round((approved / closed) * 1000) / 1000,
      median_time_to_verdict_hours: null,
      discuss_rate: list.length ? Math.round((list.filter((r) => r.lastChoice === "Discuss").length / list.length) * 1000) / 1000 : 0,
      timeout_rate: list.length ? Math.round((list.filter((r) => r.appliedBy === "timeout").length / list.length) * 1000) / 1000 : 0,
      split_rate: list.length ? Math.round((list.filter((r) => r.needsSplit).length / list.length) * 1000) / 1000 : 0,
    };
  });
}
