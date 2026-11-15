import { STATUS, isClosedStatus } from "@/lib/decide";
import { waitingAreaCounts, waitingQueue } from "@/lib/queue";
import type { BriefRow } from "@/lib/types";

/**
 * Desk views. "waiting" is the default desk (no `view` param): only what is
 * waiting on you. The rest sit behind the nav. "all" is every open item.
 */
export const VIEWS = ["waiting", "flight", "parked", "done", "all"] as const;
export type View = (typeof VIEWS)[number];
export const DEFAULT_VIEW: View = "waiting";

export const VIEW_STATUS: Record<View, string | null> = {
  waiting: STATUS.waiting,
  flight: STATUS.inFlight,
  parked: STATUS.parked,
  done: STATUS.done,
  all: null,
};

export const VIEW_LABEL: Record<View, string> = {
  waiting: "Waiting on you",
  flight: "In flight",
  parked: "Parked",
  done: "Done",
  all: "All open",
};

export function parseView(value: string | null | undefined): View {
  return (VIEWS as readonly string[]).includes(value ?? "") ? (value as View) : DEFAULT_VIEW;
}

export type DeskScope = {
  area: string | null;
  view: View;
  includeDone: boolean;
};

function scopeQuery(scope: Partial<DeskScope>): string {
  const params = new URLSearchParams();
  if (scope.view && scope.view !== DEFAULT_VIEW) params.set("view", scope.view);
  if (scope.area) params.set("area", scope.area);
  if (scope.includeDone && scope.view !== "done") params.set("done", "1");
  return params.toString();
}

/** Each view has its own route under the desk; Home ("/") is the lay of the land. */
export const VIEW_SLUG: Record<View, string> = {
  waiting: "waiting",
  flight: "in-flight",
  parked: "parked",
  done: "done",
  all: "all",
};

export const HOME_HREF = "/";

/** Kanban of the configured task store. */
export const BOARD_HREF = "/board";
export const REVIEW_HREF = "/review";
export const BATCH_HREF = "/batch";
export const STATS_HREF = "/stats";

export function viewFromSlug(slug: string | null | undefined): View | null {
  const hit = (Object.entries(VIEW_SLUG) as [View, string][]).find(([, s]) => s === slug);
  return hit ? hit[0] : null;
}

/** List URL for a scope ("/waiting", "/in-flight?area=X"). */
export function deskHref(scope: Partial<DeskScope>): string {
  const view = scope.view ?? DEFAULT_VIEW;
  const params = new URLSearchParams();
  if (scope.area) params.set("area", scope.area);
  if (scope.includeDone && view !== "done") params.set("done", "1");
  const qs = params.toString();
  const base = `/${VIEW_SLUG[view]}`;
  return qs ? `${base}?${qs}` : base;
}

/**
 * Before round 5 the desk root was the list (`/?view=flight&area=X`, `/?done=1`).
 * Returns where such a link now lives, or null when it is a plain Home visit.
 */
export function legacyListHref(params: { view?: string; area?: string; done?: string }): string | null {
  if (!params.view && !params.area && params.done !== "1") return null;
  const view = viewFromLegacy(params.view);
  return deskHref({
    view: view ?? (params.done === "1" && !params.area ? "all" : DEFAULT_VIEW),
    area: params.area ?? null,
    includeDone: params.done === "1",
  });
}

function viewFromLegacy(value: string | undefined): View | null {
  return (VIEWS as readonly string[]).includes(value ?? "") ? (value as View) : null;
}

/** Decision URL that keeps the desk scope, so Prev / Next stay inside it. */
export function decisionHref(id: string, scope: Partial<DeskScope>): string {
  const qs = scopeQuery(scope);
  return qs ? `/d/${id}?${qs}` : `/d/${id}`;
}

/** Rows visible in a scope: area, then status for a view; Done/Declined hidden unless asked for. */
export function scopeRows(rows: BriefRow[], scope: DeskScope): BriefRow[] {
  const includeClosed = scope.includeDone || scope.view === "done";
  return rows.filter((row) => {
    if (!includeClosed && isClosedStatus(row.status)) return false;
    if (scope.area && (row.project ?? "Unassigned") !== scope.area) return false;
    if (scope.view === "done") return isClosedStatus(row.status);
    if (scope.view === "parked") return row.status === STATUS.parked;
    const status = VIEW_STATUS[scope.view];
    if (status && row.status !== status) return false;
    return true;
  });
}

export type NavModel = {
  views: { key: View; label: string; count: number; href: string; active: boolean }[];
  areas: { area: string; count: number; href: string; active: boolean }[];
  allAreasHref: string;
  totalWaiting: number;
  queue: BriefRow[];
};

/**
 * Left-nav data. View counts cover the selected area; area counts are items
 * waiting on you (same as the desk's area filter); the queue is the
 * waiting list in the selected area, highest-stakes first (`QUEUE_SORT=age` for oldest first).
 */
export function buildNav(rows: BriefRow[], scope: DeskScope): NavModel {
  const inArea = scopeRows(rows, { area: scope.area, view: "all", includeDone: true });
  const views: NavModel["views"] = VIEWS.map((view) => ({
    key: view,
    label: VIEW_LABEL[view],
    count: scopeRows(inArea, { area: null, view, includeDone: scope.includeDone }).length,
    href: deskHref({ area: scope.area, view, includeDone: scope.includeDone }),
    active: scope.view === view,
  }));
  const areaScope = scopeRows(rows, { area: null, view: "all", includeDone: scope.includeDone });
  const areas = waitingAreaCounts(areaScope).map(({ area, count: waiting }) => ({
    area,
    count: waiting,
    href: deskHref({ area, view: scope.view, includeDone: scope.includeDone }),
    active: scope.area === area,
  }));
  return {
    views,
    areas,
    allAreasHref: deskHref({ view: scope.view, includeDone: scope.includeDone }),
    totalWaiting: areaScope.filter((row) => row.status === STATUS.waiting).length,
    queue: waitingQueue(inArea),
  };
}

export type HomeModel = {
  counts: { view: View; label: string; count: number; href: string }[];
  areas: { area: string; waiting: number; open: number; href: string }[];
  oldest: BriefRow[];
  recent: BriefRow[];
  totalWaiting: number;
  next: BriefRow | null;
};

/**
 * Home: counts by status and area, the highest-stakes waiting items, and what
 * changed most recently (by Last updated, any status).
 */
export function buildHome(rows: BriefRow[], limit = 4): HomeModel {
  const counts = (["waiting", "flight", "parked", "done"] as View[]).map((view) => ({
    view,
    label: VIEW_LABEL[view],
    count: scopeRows(rows, { area: null, view, includeDone: true }).length,
    href: deskHref({ view }),
  }));
  const open = scopeRows(rows, { area: null, view: "all", includeDone: false });
  const map = new Map<string, { waiting: number; open: number }>();
  for (const row of open) {
    const area = row.project ?? "Unassigned";
    const entry = map.get(area) ?? { waiting: 0, open: 0 };
    entry.open += 1;
    if (row.status === STATUS.waiting) entry.waiting += 1;
    map.set(area, entry);
  }
  const areas = [...map.entries()]
    .map(([area, c]) => ({ area, ...c, href: deskHref({ view: c.waiting ? "waiting" : "all", area }) }))
    .sort((a, b) => b.waiting - a.waiting || b.open - a.open || a.area.localeCompare(b.area));
  const queue = waitingQueue(rows);
  const recent = [...rows]
    .filter((row) => row.lastUpdated)
    .sort((a, b) => (b.lastUpdated ?? "").localeCompare(a.lastUpdated ?? ""))
    .slice(0, limit);
  return {
    counts,
    areas,
    oldest: queue.slice(0, limit),
    recent,
    totalWaiting: queue.length,
    next: queue[0] ?? null,
  };
}
