/**
 * Spec 11 data model (pointers only). No scraping, no transcripts.
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
  raisedBy?: { id: string; name?: string | null } | null;
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
const APP_SLUG = /^[\w.-]{1,32}$/;

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

export function parseChatStaleDays(env: Record<string, string | undefined> = process.env): number {
  const raw = Number.parseInt((env.CHAT_STALE_DAYS ?? "").trim(), 10);
  if (Number.isInteger(raw) && raw >= 1 && raw < 3650) return raw;
  return DEFAULT_CHAT_STALE_DAYS;
}

export function defaultComeBackBy(now: Date | string = new Date(), days = DEFAULT_CHAT_REVISIT_DAYS, timeZone?: string): string {
  const today = typeof now === "string" && isYmd(now) ? now : todayYmd(now instanceof Date ? now : new Date(), timeZone);
  return addDaysYmd(today, days);
}

export function detectChatApp(url: string | null | undefined): { app: string; linkKind: ChatLinkKind; temp: boolean } {
  if (!url) return { app: "other", linkKind: "none", temp: false };
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
      return { app: rule.app, linkKind: share ? "share" : "private", temp: Boolean(rule.temp) };
    }
  }
  return { app: "other", linkKind: "unknown", temp: false };
}

export function normalizeChatUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
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
    return null;
  }
}

export function chatOverdue(comeBackBy: string | null | undefined, today: string): boolean {
  return isOverdueYmd(comeBackBy ?? null, today);
}

export function chatSuggestClose(
  chat: Pick<ChatPointer, "status" | "comeBackBy" | "createdAt" | "missedCount">,
  today: string,
  staleDays = DEFAULT_CHAT_STALE_DAYS,
): boolean {
  if (chat.status !== "open" && chat.status !== "resumed") return false;
  if (chat.missedCount >= 2) return true;
  const created = chat.createdAt.slice(0, 10);
  if (isYmd(created) && addDaysYmd(created, staleDays) <= today) return true;
  return false;
}

export function sessionOverdueChats(
  chats: ChatPointer[],
  today: string,
  cap = DEFAULT_SESSION_CHAT_CAP,
): ChatPointer[] {
  return chats
    .filter((c) => (c.status === "open" || c.status === "resumed") && chatOverdue(c.comeBackBy, today))
    .sort((a, b) => a.comeBackBy.localeCompare(b.comeBackBy) || a.createdAt.localeCompare(b.createdAt))
    .slice(0, cap);
}

export function activeChats(chats: ChatPointer[]): ChatPointer[] {
  return chats.filter((c) => c.status === "open" || c.status === "resumed");
}

export function groupChatsByApp(chats: ChatPointer[], today: string): { app: string; rows: ChatPointer[] }[] {
  const by = new Map<string, ChatPointer[]>();
  for (const chat of chats) {
    const list = by.get(chat.app) ?? [];
    list.push(chat);
    by.set(chat.app, list);
  }
  return [...by.entries()]
    .map(([app, rows]) => ({
      app,
      rows: rows.sort((a, b) => {
        const ao = Number(chatOverdue(b.comeBackBy, today)) - Number(chatOverdue(a.comeBackBy, today));
        if (ao !== 0) return ao;
        return a.comeBackBy.localeCompare(b.comeBackBy) || a.createdAt.localeCompare(b.createdAt);
      }),
    }))
    .sort((a, b) => a.app.localeCompare(b.app));
}

export type ParsedAddChat = {
  url: string | null;
  normalizedUrl: string | null;
  app: string;
  title: string;
  nextStep: string;
  comeBackBy: string;
  ephemeral: boolean;
  note: string | null;
  linkKind: ChatLinkKind;
};

export type AddChatBody = {
  url?: unknown;
  app?: unknown;
  title?: unknown;
  next_step?: unknown;
  left_off_at?: unknown;
  come_back_by?: unknown;
  ephemeral?: unknown;
  note?: unknown;
};

export function parseAddChat(
  body: AddChatBody,
  opts: { today: string; revisitDays?: number },
): { ok: true; value: ParsedAddChat } | { ok: false; field: string; error: string } {
  const nextStep = String(body.next_step ?? body.left_off_at ?? "").trim();
  if (!nextStep) return { ok: false, field: "next_step", error: "next_step is required" };
  if (nextStep.length > 240) return { ok: false, field: "next_step", error: "next_step must be at most 240 characters" };

  const rawUrl = body.url == null || body.url === "" ? null : typeof body.url === "string" ? body.url.trim() : null;
  if (body.url != null && body.url !== "" && typeof body.url !== "string") {
    return { ok: false, field: "url", error: "url must be a string" };
  }
  const normalizedUrl = rawUrl ? normalizeChatUrl(rawUrl) : null;
  if (rawUrl && !normalizedUrl) return { ok: false, field: "url", error: "url must be an http(s) URL" };

  const detected = detectChatApp(normalizedUrl ?? rawUrl);
  if (body.app != null && body.app !== "" && typeof body.app !== "string") {
    return { ok: false, field: "app", error: "app must be a string" };
  }
  let app = typeof body.app === "string" ? body.app.trim().toLowerCase() : "";
  if (app && !APP_SLUG.test(app)) return { ok: false, field: "app", error: "app must be a short slug" };
  if (!normalizedUrl && !app) return { ok: false, field: "url", error: "url or app is required" };
  if (!app) app = detected.app;

  const titleRaw = typeof body.title === "string" ? body.title.trim() : "";
  if (titleRaw.length > 120) return { ok: false, field: "title", error: "title must be at most 120 characters" };
  const title = titleRaw || `${app} ${opts.today}`;

  const comeBack = typeof body.come_back_by === "string" ? body.come_back_by.trim() : "";
  const comeBackBy = comeBack || defaultComeBackBy(opts.today, opts.revisitDays ?? DEFAULT_CHAT_REVISIT_DAYS);
  if (!isYmd(comeBackBy)) return { ok: false, field: "come_back_by", error: "come_back_by must be YYYY-MM-DD" };

  if (body.ephemeral != null && typeof body.ephemeral !== "boolean") {
    return { ok: false, field: "ephemeral", error: "ephemeral must be a boolean" };
  }
  const ephemeral = body.ephemeral === true || detected.temp;

  const note = body.note == null || body.note === "" ? null : typeof body.note === "string" ? body.note.trim() : null;
  if (body.note != null && body.note !== "" && typeof body.note !== "string") {
    return { ok: false, field: "note", error: "note must be a string" };
  }
  if (note && note.length > 500) return { ok: false, field: "note", error: "note must be at most 500 characters" };

  return {
    ok: true,
    value: {
      url: normalizedUrl,
      normalizedUrl,
      app,
      title,
      nextStep,
      comeBackBy,
      ephemeral,
      note,
      linkKind: detected.linkKind,
    },
  };
}

export function findChatByNormalizedUrl(chats: ChatPointer[], normalizedUrl: string | null): ChatPointer | null {
  if (!normalizedUrl) return null;
  return chats.find((c) => c.normalizedUrl === normalizedUrl) ?? null;
}

export function snakeChat(chat: ChatPointer) {
  return {
    id: chat.id,
    url: chat.url,
    normalized_url: chat.normalizedUrl,
    app: chat.app,
    title: chat.title,
    next_step: chat.nextStep,
    come_back_by: chat.comeBackBy,
    status: chat.status,
    ephemeral: chat.ephemeral,
    note: chat.note,
    link_kind: chat.linkKind,
    link_dead: chat.linkDead,
    converted_to_type: chat.convertedToType,
    converted_to_id: chat.convertedToId,
    missed_count: chat.missedCount,
    created_at: chat.createdAt,
    last_updated: chat.lastUpdated,
  };
}
