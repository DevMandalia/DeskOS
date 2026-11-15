import type { CostOfDelay } from "./brief";

export const QUEUE_SORTS = ["stakes", "age"] as const;
export type QueueSort = (typeof QUEUE_SORTS)[number];

const COST_RANK: Record<CostOfDelay, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function costRank(value: CostOfDelay | null | undefined): number {
  if (!value) return 4;
  return COST_RANK[value];
}

export function parseQueueSort(value: string | null | undefined): QueueSort | null {
  const raw = (value ?? "").trim().toLowerCase();
  if (raw === "stakes" || raw === "age") return raw;
  return null;
}

/**
 * Demo defaults to stakes so the sample Home shows cost-of-delay ordering.
 * Live / private desks default to age until the owner sets QUEUE_SORT.
 */
export function resolveQueueSort(env: {
  QUEUE_SORT?: string;
  DESK_DEMO?: string;
  NEXT_PUBLIC_DESK_DEMO?: string;
  NEXT_PUBLIC_QUEUE_SORT?: string;
}): QueueSort {
  const explicit = parseQueueSort(env.QUEUE_SORT) ?? parseQueueSort(env.NEXT_PUBLIC_QUEUE_SORT);
  if (explicit) return explicit;
  if (env.DESK_DEMO === "1" || env.NEXT_PUBLIC_DESK_DEMO === "1") return "stakes";
  return "age";
}

export function startCtaLabel(sort: QueueSort): string {
  return sort === "stakes" ? "Start with the highest-stakes" : "Start with the oldest";
}

export function waitingListLabel(sort: QueueSort): string {
  return sort === "stakes" ? "Highest-stakes waiting on you" : "Oldest waiting on you";
}

export function queueOrderHint(sort: QueueSort): string {
  return sort === "stakes" ? "highest-stakes first" : "oldest first";
}

export type SortableDecision = {
  costOfDelay?: CostOfDelay | null;
  deadline?: string | null;
  lastUpdated?: string | null;
  item: string;
};

function deadlineKey(value: string | null | undefined): string {
  if (!value) return "9999-99-99";
  return value.slice(0, 10);
}

function ageKey(value: string | null | undefined): string {
  if (!value) return "9999-99-99";
  return value.slice(0, 10);
}

/** Stakes: cost of delay, then earlier deadline, then older first. Age: older first. */
export function compareWaiting(
  a: SortableDecision,
  b: SortableDecision,
  sort: QueueSort,
): number {
  if (sort === "stakes") {
    const cost = costRank(a.costOfDelay ?? null) - costRank(b.costOfDelay ?? null);
    if (cost !== 0) return cost;
    const deadline = deadlineKey(a.deadline).localeCompare(deadlineKey(b.deadline));
    if (deadline !== 0) return deadline;
  }
  return (
    ageKey(a.lastUpdated).localeCompare(ageKey(b.lastUpdated)) ||
    (a.lastUpdated ?? "").localeCompare(b.lastUpdated ?? "") ||
    a.item.localeCompare(b.item)
  );
}

export function compareParked(
  a: { revisitAt?: string | null; lastUpdated?: string | null; item: string },
  b: { revisitAt?: string | null; lastUpdated?: string | null; item: string },
): number {
  const aKey = a.revisitAt ? a.revisitAt.slice(0, 10) : "9999-99-99";
  const bKey = b.revisitAt ? b.revisitAt.slice(0, 10) : "9999-99-99";
  return (
    aKey.localeCompare(bKey) ||
    (a.lastUpdated ?? "").localeCompare(b.lastUpdated ?? "") ||
    a.item.localeCompare(b.item)
  );
}

export function defaultRevisitDate(
  now = new Date(),
  days = 30,
): string {
  const next = new Date(now.getTime() + days * 86_400_000);
  return next.toISOString().slice(0, 10);
}

export function parkRevisitDays(env: Record<string, string | undefined> = process.env): number {
  const raw = Number.parseInt((env.PARK_REVISIT_DAYS ?? "").trim(), 10);
  if (Number.isFinite(raw) && raw > 0 && raw < 3650) return raw;
  return 30;
}
