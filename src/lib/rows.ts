import "server-only";

import { loadDecisionSource } from "@/adapters/load";
import { compareStatus } from "@/lib/decide";
import { idsEqual } from "@/lib/ids";
import type { BriefRow, Decision, DecisionSource, DeskBlock, DiscussionMessage } from "@/lib/types";

let cached: DecisionSource | null = null;

export async function decisionSource(): Promise<DecisionSource> {
  if (!cached) cached = await loadDecisionSource();
  return cached;
}

export async function listRows(): Promise<BriefRow[]> {
  const rows = await (await decisionSource()).list();
  return [...rows].sort((a, b) => {
    const status = compareStatus(a.status, b.status);
    if (status !== 0) return status;
    return (b.lastUpdated ?? "").localeCompare(a.lastUpdated ?? "");
  });
}

export async function getRow(id: string): Promise<BriefRow | null> {
  return (await decisionSource()).get(id);
}

export async function getRowBody(row: Decision): Promise<DeskBlock[]> {
  return (await decisionSource()).getBody(row);
}

export async function listDiscussion(id: string): Promise<DiscussionMessage[]> {
  return (await decisionSource()).listDiscussion(id);
}

export function neighbors(
  rows: BriefRow[],
  id: string,
): { prev: BriefRow | null; next: BriefRow | null } {
  const index = rows.findIndex((row) => idsEqual(row.id, id));
  if (index < 0) return { prev: null, next: null };
  return {
    prev: rows[index - 1] ?? null,
    next: rows[index + 1] ?? null,
  };
}

export function resetDecisionSourceCache(): void {
  cached = null;
}
