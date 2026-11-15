import type { BoardColumn, ColumnKey, Task, TaskBoard, TaskPatch } from "@/lib/tasks/types";
import { deskTimezone } from "@/lib/env";

export type ColumnSpec = { label: string; candidates: string[] };

const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, " ");

export function slugColumn(label: string, index: number): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || `col-${index}`;
}

/**
 * Parse BOARD_COLUMNS. Accepts a comma list ("Backlog,To do,Done") or JSON
 * `[{ "label": "Ready", "candidates": ["Ready", "To do"] }]`.
 */
export function parseBoardColumns(raw: string | undefined | null): ColumnSpec[] | null {
  const text = (raw ?? "").trim();
  if (!text) return null;
  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (!Array.isArray(parsed) || parsed.length === 0) return null;
      const specs: ColumnSpec[] = [];
      for (const item of parsed) {
        if (typeof item === "string" && item.trim()) {
          specs.push({ label: item.trim(), candidates: [item.trim()] });
          continue;
        }
        if (item && typeof item === "object" && "label" in item) {
          const label = String((item as { label: unknown }).label).trim();
          if (!label) continue;
          const candidates = Array.isArray((item as { candidates?: unknown }).candidates)
            ? (item as { candidates: unknown[] }).candidates.map((c) => String(c))
            : [label];
          specs.push({ label, candidates });
        }
      }
      return specs.length ? specs : null;
    } catch {
      return null;
    }
  }
  const labels = text.split(",").map((s) => s.trim()).filter(Boolean);
  if (!labels.length) return null;
  return labels.map((label) => ({ label, candidates: [label] }));
}

/**
 * Map configured column labels onto the store's real status options.
 * If nothing is configured, one column per status option (store order).
 */
export function resolveColumns(
  statusOptions: string[],
  configured?: ColumnSpec[] | null,
): BoardColumn[] {
  if (configured && configured.length > 0) {
    return configured.map((spec, i) => {
      const hit = spec.candidates
        .map((c) => statusOptions.find((o) => norm(o) === norm(c)))
        .find(Boolean);
      return { key: slugColumn(spec.label, i), label: spec.label, status: hit ?? null };
    });
  }
  return statusOptions.map((name, i) => ({
    key: slugColumn(name, i),
    label: name,
    status: name,
  }));
}

export function configuredColumns(): ColumnSpec[] | null {
  return parseBoardColumns(process.env.BOARD_COLUMNS);
}

/** Column a task sits in. Unknown status lands in the first column. */
export function columnOf(task: Pick<Task, "status">, columns: BoardColumn[]): ColumnKey {
  if (!columns.length) return "col-0";
  if (task.status) {
    const hit = columns.find((c) => c.status && norm(c.status) === norm(task.status!));
    if (hit) return hit.key;
  }
  return columns[0].key;
}

/** Status for a task added from quick-add: first column that has a writable status. */
export function quickAddStatus(columns: BoardColumn[]): string | null {
  return columns.find((c) => c.status)?.status ?? null;
}

const PRIORITY_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2 };

/** Within a column: priority, then Rank, then due date, then most recently edited. Last column: newest first if it looks like Done. */
export function compareTasks(key: ColumnKey, columns: BoardColumn[] = []) {
  const last = columns[columns.length - 1];
  const isDoneLane = Boolean(last && last.key === key && /done|complete/i.test(last.label));
  return (a: Task, b: Task): number => {
    if (isDoneLane) return (b.lastEdited ?? "").localeCompare(a.lastEdited ?? "");
    const pa = PRIORITY_ORDER[a.priority ?? ""] ?? 9;
    const pb = PRIORITY_ORDER[b.priority ?? ""] ?? 9;
    if (pa !== pb) return pa - pb;
    const ra = a.rank ?? Number.POSITIVE_INFINITY;
    const rb = b.rank ?? Number.POSITIVE_INFINITY;
    if (ra !== rb) return ra - rb;
    if (a.due !== b.due) {
      if (!a.due) return 1;
      if (!b.due) return -1;
      return a.due.localeCompare(b.due);
    }
    return (b.lastEdited ?? "").localeCompare(a.lastEdited ?? "");
  };
}

export type BoardLane = BoardColumn & { tasks: Task[] };

export function buildLanes(
  tasks: Task[],
  columns: BoardColumn[],
  area: string | null = null,
  pinned: ReadonlySet<string> = new Set(),
): BoardLane[] {
  const lanes = columns.map((c) => ({ ...c, tasks: [] as Task[] }));
  for (const task of tasks) {
    if (area && (task.area ?? "") !== area) continue;
    const key = columnOf(task, columns);
    (lanes.find((l) => l.key === key) ?? lanes[0])?.tasks.push(task);
  }
  for (const lane of lanes) {
    const cmp = compareTasks(lane.key, columns);
    lane.tasks.sort((a, b) => Number(pinned.has(b.id)) - Number(pinned.has(a.id)) || cmp(a, b));
  }
  return lanes;
}

export function applyPatch(task: Task, patch: TaskPatch): Task {
  const next = { ...task };
  if (patch.title !== undefined) next.title = patch.title;
  if (patch.status !== undefined) next.status = patch.status;
  if (patch.area !== undefined) next.area = patch.area;
  if (patch.due !== undefined) next.due = patch.due;
  return next;
}

export function mergeBoard(fresh: TaskBoard, local: Task[], pending: Set<string>): Task[] {
  const freshIds = new Set(fresh.tasks.map((t) => t.id));
  const merged = fresh.tasks.map((t) => (pending.has(t.id) ? (local.find((l) => l.id === t.id) ?? t) : t));
  for (const t of local) {
    if (pending.has(t.id) && !freshIds.has(t.id)) merged.unshift(t);
  }
  return merged;
}

export function parseQuickAdd(text: string, areas: string[]): { title: string; area: string | null } {
  let area: string | null = null;
  const title = text
    .replace(/(^|\s)#(?:"([^"]+)"|(\S+))/g, (whole, lead: string, quoted?: string, bare?: string) => {
      if (area) return whole;
      const wanted = norm((quoted ?? bare ?? "").replace(/-/g, " "));
      const hit = areas.find((a) => norm(a) === wanted);
      if (!hit) return whole;
      area = hit;
      return lead;
    })
    .replace(/\s+/g, " ")
    .trim();
  return { title, area };
}

export function dueLabel(due: string | null, today: string): { text: string; overdue: boolean } | null {
  if (!due) return null;
  const day = due.slice(0, 10);
  const pretty = new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  if (day === today) return { text: "Due today", overdue: false };
  if (day < today) return { text: `Overdue · ${pretty}`, overdue: true };
  return { text: `Due ${pretty}`, overdue: false };
}

export function boardToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: deskTimezone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** @deprecated Use boardToday. */
export function pacificToday(now: Date = new Date()): string {
  return boardToday(now);
}

export const LANE_LIMIT = 40;
