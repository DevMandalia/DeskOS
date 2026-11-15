import type { CostOfDelay, DoorType } from "./brief";
import { addDaysYmd, isOverdueYmd, isYmd, todayYmd } from "./dates";

export const QUEUE_SORTS = ["stakes", "age"] as const;
export type QueueSort = (typeof QUEUE_SORTS)[number];

const COST_RANK: Record<CostOfDelay, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const DOOR_RANK: Record<DoorType, number> = {
  one_way: 0,
  two_way: 1,
};

export function costRank(value: CostOfDelay | null | undefined): number {
  if (!value) return COST_RANK.medium;
  return COST_RANK[value];
}

export function doorRank(value: DoorType | null | undefined): number {
  if (!value) return 2;
  return DOOR_RANK[value];
}

export function parseQueueSort(value: string | null | undefined): QueueSort | null {
  const raw = (value ?? "").trim().toLowerCase();
  if (raw === "stakes" || raw === "age") return raw;
  return null;
}

/**
 * Spec 03 default is stakes. Private desk passes fallback "age" until confirmed.
 */
export function resolveQueueSort(
  env: {
    QUEUE_SORT?: string;
    NEXT_PUBLIC_QUEUE_SORT?: string;
  },
  fallback: QueueSort = "stakes",
): QueueSort {
  return parseQueueSort(env.QUEUE_SORT) ?? parseQueueSort(env.NEXT_PUBLIC_QUEUE_SORT) ?? fallback;
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
  doorType?: DoorType | null;
  door?: DoorType | null;
  deadline?: string | null;
  lastUpdated?: string | null;
  item: string;
  revisitState?: "scheduled" | "expired" | null;
};

export function isOverdueClass(
  row: SortableDecision,
  today: string,
): boolean {
  if (row.revisitState === "expired") return true;
  return isOverdueYmd(row.deadline ?? null, today);
}

function ageKey(value: string | null | undefined): string {
  if (!value) return "9999-99-99";
  return value.slice(0, 10);
}

function doorOf(row: SortableDecision): DoorType | null {
  return row.doorType ?? row.door ?? null;
}

/** Spec 03: overdue-class, cost (missing=medium), door (null last), then age. */
export function compareWaiting(
  a: SortableDecision,
  b: SortableDecision,
  sort: QueueSort,
  today?: string,
): number {
  if (sort === "stakes") {
    const day = today ?? "9999-99-99";
    const overdue = Number(isOverdueClass(b, day)) - Number(isOverdueClass(a, day));
    if (overdue !== 0) return overdue;
    const cost = costRank(a.costOfDelay ?? null) - costRank(b.costOfDelay ?? null);
    if (cost !== 0) return cost;
    const door = doorRank(doorOf(a)) - doorRank(doorOf(b));
    if (door !== 0) return door;
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

export function parkRevisitDays(env: Record<string, string | undefined> = process.env): number {
  const raw = Number.parseInt((env.PARK_REVISIT_DAYS ?? "").trim(), 10);
  if (Number.isFinite(raw) && raw >= 1 && raw < 3650) return raw;
  return 30;
}

export function defaultRevisitDate(
  now: Date | string = new Date(),
  days = 30,
  timeZone?: string,
): string {
  const today = typeof now === "string" && isYmd(now) ? now : todayYmd(now instanceof Date ? now : new Date(), timeZone);
  return addDaysYmd(today, days);
}
