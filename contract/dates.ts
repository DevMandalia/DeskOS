/** Calendar dates are YYYY-MM-DD in DESK_TIMEZONE (default America/Los_Angeles). */

export const DEFAULT_TIMEZONE = "America/Los_Angeles";

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isYmd(value: string | null | undefined): value is string {
  return Boolean(value && YMD.test(value));
}

export function parseYmd(value: unknown): string | null {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  return YMD.test(raw) ? raw : null;
}

export function todayYmd(now = new Date(), timeZone = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDaysYmd(ymd: string, days: number): string {
  const match = ymd.match(YMD);
  if (!match) return ymd;
  const utc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days);
  const d = new Date(utc);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** date < today. Due today is not overdue. Invalid dates are not overdue. */
export function isOverdueYmd(value: string | null | undefined, today: string): boolean {
  if (!isYmd(value) || !isYmd(today)) return false;
  return value < today;
}

export function isFutureOrTodayYmd(value: string, today: string): boolean {
  return isYmd(value) && value >= today;
}
