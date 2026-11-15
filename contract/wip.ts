/** Spec 06: Board WIP cap and doing/ready column matchers. Core only — no adapter code. */

export const DEFAULT_BOARD_WIP_LIMIT = 3;
export const WIP_ENFORCE = ["confirm", "block", "off"] as const;
export type WipEnforce = (typeof WIP_ENFORCE)[number];

const DOING_RE = /in progress|doing|wip/i;
const READY_RE = /to do|todo|ready/i;

export function parseWipLimit(env: Record<string, string | undefined> = process.env): number {
  const raw = Number.parseInt((env.BOARD_WIP_LIMIT ?? "").trim(), 10);
  if (Number.isInteger(raw) && raw >= 1 && raw < 10_000) return raw;
  return DEFAULT_BOARD_WIP_LIMIT;
}

export function parseWipEnforce(env: Record<string, string | undefined> = process.env): WipEnforce {
  const raw = (env.BOARD_WIP_ENFORCE ?? "confirm").trim().toLowerCase();
  if (raw === "block" || raw === "off" || raw === "confirm") return raw;
  return "confirm";
}

export function matchesColumn(
  column: { label?: string | null; status?: string | null },
  override: string | null | undefined,
  fallback: RegExp,
): boolean {
  const wanted = (override ?? "").trim().toLowerCase();
  if (wanted) {
    return [column.label, column.status].some((v) => (v ?? "").trim().toLowerCase() === wanted);
  }
  return fallback.test(column.label ?? "") || fallback.test(column.status ?? "");
}

export function findDoingColumn<T extends { label?: string | null; status?: string | null }>(
  columns: T[],
  env: Record<string, string | undefined> = process.env,
): T | null {
  const override = env.BOARD_WIP_COLUMN;
  return columns.find((col) => matchesColumn(col, override, DOING_RE)) ?? null;
}

export function findReadyColumn<T extends { label?: string | null; status?: string | null }>(
  columns: T[],
  env: Record<string, string | undefined> = process.env,
): T | null {
  const override = env.BOARD_READY_COLUMN;
  return columns.find((col) => matchesColumn(col, override, READY_RE)) ?? null;
}

export function isDoingStatus(
  status: string | null | undefined,
  doing: { label?: string | null; status?: string | null } | null,
): boolean {
  if (!status || !doing) return false;
  const n = status.trim().toLowerCase();
  return n === (doing.status ?? "").trim().toLowerCase() || n === (doing.label ?? "").trim().toLowerCase();
}

export function doingCount(
  tasks: { status?: string | null }[],
  doing: { label?: string | null; status?: string | null } | null,
): number {
  if (!doing) return 0;
  return tasks.filter((task) => isDoingStatus(task.status, doing)).length;
}

export type WipCheck = {
  over: boolean;
  nextCount: number;
  limit: number;
  enforce: WipEnforce;
  doingLabel: string;
};

export function wipMoveCheck(
  tasks: { id: string; status?: string | null }[],
  taskId: string,
  nextStatus: string | null | undefined,
  doing: { label?: string | null; status?: string | null } | null,
  env: Record<string, string | undefined> = process.env,
): WipCheck {
  const limit = parseWipLimit(env);
  const enforce = parseWipEnforce(env);
  const doingLabel = doing?.label || doing?.status || "In progress";
  const current = tasks.find((task) => task.id === taskId);
  const alreadyDoing = isDoingStatus(current?.status, doing);
  const entering = isDoingStatus(nextStatus, doing);
  const count = doingCount(tasks, doing);
  const nextCount = entering && !alreadyDoing ? count + 1 : !entering && alreadyDoing ? Math.max(0, count - 1) : count;
  return {
    over: Boolean(entering && !alreadyDoing && nextCount > limit),
    nextCount,
    limit,
    enforce,
    doingLabel,
  };
}

/** Agent/owner create into a full doing column: still 201, overflow tagged. */
export function createWouldOverflow(
  tasks: { status?: string | null }[],
  status: string,
  doing: { label?: string | null; status?: string | null } | null,
  limit: number,
): boolean {
  if (!doing || !isDoingStatus(status, doing)) return false;
  return doingCount(tasks, doing) >= limit;
}

export function overflowIndex(index: number, focused: boolean, limit: number): boolean {
  if (focused) return false;
  return index >= limit;
}
