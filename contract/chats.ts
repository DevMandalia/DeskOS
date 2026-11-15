/**
 * Spec 11 data model (pointers only). No scraping, no transcripts.
 * Implemented in batch 4; types land earlier so batches 2–3 can reserve room.
 */

import { addDaysYmd, isOverdueYmd, isYmd, todayYmd } from "./dates";

export const CHAT_STATUSES = ["open", "resumed", "closed", "converted"] as const;
export type ChatStatus = (typeof CHAT_STATUSES)[number];

export const DEFAULT_CHAT_REVISIT_DAYS = 3;
export const DEFAULT_SESSION_CHAT_CAP = 2;
export const DEFAULT_CHAT_STALE_DAYS = 14;

export type ChatLinkKind = "private" | "share" | "unknown" | "none";

export type ChatPointer = {
  id: string;
  url: string | null;
  normalizedUrl: string | null;
  app: string;
  title: string;
  nextStep: string;
  comeBackBy: string;
  status: ChatStatus;
  ephemeral: boolean;
  note: string | null;
  linkKind: ChatLinkKind;
  linkDead: boolean;
  convertedToType: "task" | "decision" | null;
  convertedToId: string | null;
  missedCount: number;
  createdAt: string;
  lastUpdated: string;
};

export const DEFAULT_CHAT_APPS: { host: string; app: string; share?: boolean; temp?: boolean }[] = [
  { host: "claude.ai", app: "claude", share: true },
  { host: "chatgpt.com", app: "chatgpt", share: true },
  { host: "chat.openai.com", app: "chatgpt", share: true },
  { host: "grok.com", app: "grok" },
  { host: "x.com/i/grok", app: "grok" },
  { host: "x.com/grok", app: "grok" },
  { host: "cursor.com", app: "cursor" },
];

const TRACKING = /^(utm_|fbclid|gclid|ref$)/i;

export function parseChatRevisitDays(env: Record<string, string | undefined> = process.env): number {
  const raw = Number.parseInt((env.CHAT_REVISIT_DAYS ?? "").trim(), 10);
  if (Number.isInteger(raw) && raw >= 1 && raw < 3650) return raw;
  return DEFAULT_CHAT_REVISIT_DAYS;
}

export function parseSessionChatCap(env: Record<string, string | undefined> = process.env): number {
  const raw = Number.parseInt((env.SESSION_CHAT_CAP ?? "").trim(), 10);
  if (Number.isInteger(raw) && raw >= 1 && raw < 100) return raw;
  return DEFAULT_SESSION_CHAT_CAP;
}

export function defaultComeBackBy(now: Date | string = new Date(), days = DEFAULT_CHAT_REVISIT_DAYS, timeZone?: string): string {
  const today = typeof now === "string" && isYmd(now) ? now : todayYmd(now instanceof Date ? now : new Date(), timeZone);
  return addDaysYmd(today, days);
}

export function detectChatApp(url: string | null | undefined): { app: string; linkKind: ChatLinkKind } {
  if (!url) return { app: "other", linkKind: "none" };
  let hostPath = url;
  try {
    const parsed = new URL(url);
    hostPath = `${parsed.hostname}${parsed.pathname}`.toLowerCase();
  } catch {
    hostPath = url.toLowerCase();
  }
  for (const rule of DEFAULT_CHAT_APPS) {
    if (hostPath.includes(rule.host)) {
      const share = Boolean(rule.share && /\/share\//i.test(url));
      return { app: rule.app, linkKind: share ? "share" : "private" };
    }
  }
  return { app: "other", linkKind: "unknown" };
}

export function normalizeChatUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const parsed = new URL(url.trim());
    parsed.hash = "";
    parsed.hostname = parsed.hostname.toLowerCase();
    if (parsed.protocol === "http:") parsed.protocol = "https:";
    if ((parsed.protocol === "https:" && parsed.port === "443") || (parsed.protocol === "http:" && parsed.port === "80")) {
      parsed.port = "";
    }
    const params = parsed.searchParams;
    for (const key of [...params.keys()]) {
      if (TRACKING.test(key)) params.delete(key);
    }
    let href = parsed.toString();
    if (href.endsWith("/") && parsed.pathname !== "/") href = href.slice(0, -1);
    return href;
  } catch {
    return url.trim();
  }
}

export function chatOverdue(comeBackBy: string | null | undefined, today: string): boolean {
  return isOverdueYmd(comeBackBy ?? null, today);
}
