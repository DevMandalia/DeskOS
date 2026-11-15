import "server-only";

import { loadAgentStore } from "@/adapters/load";
import { notifyAgent, notifyOwner, splitRequestEvent, verdictEvent } from "@/lib/agent-notify";
import {
  appendOverride,
  countsTowardSession,
  defaultRevisitDate,
  parkRevisitDays,
  sessionSentence,
  timeoutApplyPayload,
  mayApplyTimeouts,
  timeoutReadyToApply,
  todayYmd,
  validateCostOfDelay,
  validateDeadline,
  validateDoorType,
  validateParkDate,
  type BriefOverrideField,
} from "../../contract";
import { appendSessionLine } from "@/lib/session-log";
import { deskTimezone } from "@/lib/env";
import {
  SAVED_TOAST,
  STATUS,
  formatIsoInZone,
  formatReply,
  isAction,
  isChoice,
  isDuplicateReply,
  prependReply,
  statusForAction,
  type Action,
} from "@/lib/decide";
import { applyPatchToRow, briefOf } from "@/lib/brief-fields";
import { decisionSource, getRow } from "@/lib/rows";
import type { BriefRow, DecisionPatch, DiscussionMessage } from "@/lib/types";

const recentKeys = new Map<string, number>();

function rememberKey(key: string): boolean {
  if (!key) return false;
  const seen = recentKeys.get(key);
  if (seen && Date.now() - seen < 120_000) return true;
  recentKeys.set(key, Date.now());
  return false;
}

export type DecideResult =
  | { ok: true; duplicate: boolean; row: BriefRow; toast: string }
  | { ok: false; error: string; status: number; field?: string };

export async function executeDecision(input: {
  rowId: string;
  choice?: string | null;
  note: string;
  idempotencyKey?: string;
  revisitAt?: string | null;
  doorType?: unknown;
  costOfDelay?: unknown;
  deadline?: unknown;
  action?: string | null;
  appliedBy?: "owner" | "timeout" | "auto";
  skipTimeoutSweep?: boolean;
}): Promise<DecideResult> {
  const actionRaw = input.action ?? input.choice ?? "";
  const isOverrideOnly = !actionRaw && (input.doorType != null || input.costOfDelay != null || input.deadline != null);
  if (!isOverrideOnly && !isAction(actionRaw)) {
    return { ok: false, error: "Unknown choice", status: 400 };
  }
  const source = await decisionSource();
  const row = await getRow(input.rowId);
  if (!row) return { ok: false, error: "Row not found", status: 404 };

  if (isOverrideOnly) {
    return applyBriefOverride(row, input);
  }

  const action: Action = actionRaw as Action;
  const key = input.idempotencyKey ?? "";
  if (key && rememberKey(key)) {
    return { ok: true, duplicate: true, row, toast: SAVED_TOAST };
  }
  if (key && source.hasIdempotencyKey && (await source.hasIdempotencyKey(key))) {
    return { ok: true, duplicate: true, row, toast: SAVED_TOAST };
  }
  if (isDuplicateReply(row.reply, action, input.note)) {
    return { ok: true, duplicate: true, row, toast: SAVED_TOAST };
  }

  const at = new Date();
  const iso = formatIsoInZone(at);
  const today = todayYmd(at, deskTimezone());

  if (action === "Split") {
    return sendBackToSplit(row, input.note, iso, at, key);
  }
  if (action === "OneDecision") {
    const next = await source.patch(row.id, {
      needsSplit: false,
      splitReason: "owner_override",
      lastUpdated: at.toISOString(),
    });
    if (key && source.rememberIdempotencyKey) await source.rememberIdempotencyKey(key);
    return { ok: true, duplicate: false, row: next, toast: "Marked as one decision." };
  }

  const appliedBy = input.appliedBy ?? "owner";
  const keepParked = action === "Park" && row.revisitState === "expired";
  const counted = countsTowardSession({
    choice: action,
    keepParked,
    reopen: action === "Reopen",
    split: false,
    discuss: action === "Discuss",
  });

  if (action === "Park") {
    const raw = input.revisitAt?.trim() || defaultRevisitDate(today, parkRevisitDays());
    const parsed = validateParkDate(raw, today);
    if (!parsed.ok) return { ok: false, error: parsed.error, status: 400, field: "revisit_at" };
    return recordAction(row, "Park", input.note, at, iso, key, {
      status: STATUS.parked,
      lastChoice: "Park",
      revisitAt: parsed.value,
      revisitState: "scheduled",
      appliedBy,
      sessionCounted: counted,
      timeoutAppliedAt: appliedBy === "timeout" ? at.toISOString() : row.timeoutAppliedAt ?? null,
      timeoutAppliedChoice: appliedBy === "timeout" ? "Park" : row.timeoutAppliedChoice ?? null,
    });
  }

  if (action === "Reopen") {
    return recordAction(row, "Reopen", input.note, at, iso, key, {
      status: STATUS.waiting,
      lastChoice: null,
      revisitAt: null,
      revisitState: null,
      appliedBy: "owner",
      sessionCounted: false,
    });
  }

  if (action === "Decline") {
    return recordAction(row, "Decline", input.note, at, iso, key, {
      status: STATUS.declined,
      lastChoice: "Decline",
      revisitAt: row.revisitAt ?? null,
      revisitState: row.revisitState ?? null,
      appliedBy,
      sessionCounted: counted,
      timeoutAppliedAt: appliedBy === "timeout" ? at.toISOString() : row.timeoutAppliedAt ?? null,
      timeoutAppliedChoice: appliedBy === "timeout" ? "Decline" : row.timeoutAppliedChoice ?? null,
    });
  }

  if (action === "Approve") {
    return recordAction(row, "Approve", input.note, at, iso, key, {
      status: STATUS.inFlight,
      lastChoice: "Approve",
      appliedBy,
      sessionCounted: counted,
      timeoutAppliedAt: appliedBy === "timeout" ? at.toISOString() : row.timeoutAppliedAt ?? null,
      timeoutAppliedChoice: appliedBy === "timeout" ? "Approve" : row.timeoutAppliedChoice ?? null,
    });
  }

  const status = statusForAction(action, row.status);
  const line = formatReply(action, input.note, at);
  const reply = prependReply(row.reply, line);
  const lastUpdated = at.toISOString();
  const next = await source.recordVerdict(row.id, {
    choice: isChoice(action) ? action : row.lastChoice,
    note: input.note,
    reply,
    status,
    lastUpdated,
    // Discuss on an expired revisit stays waiting and keeps revisitState.
    revisitAt: row.revisitAt ?? null,
    revisitState: row.revisitState ?? null,
  });
  if (action === "Discuss") {
    await source.addDiscussion({
      decisionId: row.id,
      author: "owner",
      agentId: null,
      agentName: null,
      body: input.note.trim() || "Let's discuss this.",
      at: lastUpdated,
    });
  }
  if (key && source.rememberIdempotencyKey) await source.rememberIdempotencyKey(key);
  const event = verdictEvent(next, action, input.note.trim(), iso);
  if (action !== "Discuss" && next.raisedBy) {
    const agents = await loadAgentStore();
    const agent = await agents.get(next.raisedBy.id);
    await notifyAgent(agent, event);
  }
  await notifyOwner(event);
  return {
    ok: true,
    duplicate: false,
    row: next,
    toast: action === "Discuss" ? "Saved. The item stays open — reply in the thread." : SAVED_TOAST,
  };
}

async function recordAction(
  row: BriefRow,
  action: Action,
  note: string,
  at: Date,
  iso: string,
  key: string,
  patch: DecisionPatch,
): Promise<DecideResult> {
  const source = await decisionSource();
  const line = formatReply(action, note, at, {
    revisitAt: patch.revisitAt ?? null,
    appliedBy: patch.appliedBy ?? null,
  });
  const reply = prependReply(row.reply, line);
  const lastUpdated = at.toISOString();
  const storedChoice = isChoice(action) ? action : (patch.lastChoice ?? row.lastChoice);
  const next = await source.recordVerdict(row.id, {
    choice: storedChoice,
    note,
    reply,
    status: patch.status ?? row.status ?? STATUS.waiting,
    lastUpdated,
    revisitAt: patch.revisitAt ?? null,
    revisitState: patch.revisitState ?? null,
  });
  const extra = await source.patch(next.id, {
    ...patch,
    reply,
    lastUpdated,
    lastChoice: storedChoice,
  });
  await appendSessionLine({
    id: extra.id,
    item: extra.item,
    choice: action,
    appliedBy: extra.appliedBy ?? patch.appliedBy ?? "owner",
    at: lastUpdated,
    sentence: sessionSentence({
      choice: action,
      item: extra.item,
      appliedBy: extra.appliedBy ?? patch.appliedBy ?? null,
      revisitAt: extra.revisitAt ?? null,
      reversed: action === "Reopen" && row.appliedBy === "timeout",
    }),
    counts: Boolean(patch.sessionCounted),
  });
  if (key && source.rememberIdempotencyKey) await source.rememberIdempotencyKey(key);
  const event = verdictEvent(extra, action, note.trim(), iso, {
    revisit_at: extra.revisitAt ?? null,
  });
  if (extra.raisedBy) {
    const agents = await loadAgentStore();
    const agent = await agents.get(extra.raisedBy.id);
    await notifyAgent(agent, event);
  }
  await notifyOwner(event);
  return { ok: true, duplicate: false, row: extra, toast: SAVED_TOAST };
}

export async function applyDueTimeouts(rows: BriefRow[]): Promise<BriefRow[]> {
  if (!mayApplyTimeouts()) return rows;
  const today = todayYmd(new Date(), deskTimezone());
  const out = [...rows];
  for (let i = 0; i < out.length; i++) {
    const row = out[i];
    if (!timeoutReadyToApply(row, today, STATUS.waiting, { classOn: true })) continue;
    const payload = timeoutApplyPayload(row, today, new Date().toISOString());
    if (!payload) continue;
    const result = await executeDecision({
      rowId: row.id,
      choice: payload.choice,
      note: payload.note,
      appliedBy: "timeout",
      skipTimeoutSweep: true,
      revisitAt: payload.revisitAt,
    });
    if (result.ok) out[i] = result.row;
  }
  return out;
}

async function sendBackToSplit(
  row: BriefRow,
  note: string,
  iso: string,
  at: Date,
  key: string,
): Promise<DecideResult> {
  const source = await decisionSource();
  const line = formatReply("Split", note, at);
  const reply = prependReply(row.reply, line);
  const next = await source.patch(row.id, {
    needsSplit: true,
    splitReason: row.splitReason === "owner_override" ? "agent" : row.splitReason ?? "agent",
    splitSentBackAt: iso,
    status: STATUS.waiting,
    reply,
    lastUpdated: at.toISOString(),
  });
  await source.addDiscussion({
    decisionId: row.id,
    author: "owner",
    agentId: null,
    agentName: null,
    body: note.trim() || "Please split this into one decision per card.",
    at: at.toISOString(),
  });
  if (key && source.rememberIdempotencyKey) await source.rememberIdempotencyKey(key);
  const event = splitRequestEvent(next, note.trim(), iso);
  if (next.raisedBy) {
    const agents = await loadAgentStore();
    const agent = await agents.get(next.raisedBy.id);
    await notifyAgent(agent, event);
  }
  await notifyOwner(event);
  return { ok: true, duplicate: false, row: next, toast: "Sent back to split." };
}

async function applyBriefOverride(
  row: BriefRow,
  input: { doorType?: unknown; costOfDelay?: unknown; deadline?: unknown },
): Promise<DecideResult> {
  const source = await decisionSource();
  const at = new Date().toISOString();
  const overrides = [...(row.briefOverrides ?? [])];
  const patch: DecisionPatch = { briefOverrides: overrides, lastUpdated: at };

  if (input.doorType !== undefined) {
    const parsed = validateDoorType(input.doorType);
    if (!parsed.ok) return { ok: false, error: parsed.error, status: 400, field: "door_type" };
    overrides.push(...appendOverride(undefined, "door_type", row.doorType ?? null, parsed.value, at).slice(-1));
    patch.doorType = parsed.value;
  }
  if (input.costOfDelay !== undefined) {
    const parsed = validateCostOfDelay(input.costOfDelay);
    if (!parsed.ok) return { ok: false, error: parsed.error, status: 400, field: "cost_of_delay" };
    overrides.push(...appendOverride(undefined, "cost_of_delay", row.costOfDelay ?? null, parsed.value, at).slice(-1));
    patch.costOfDelay = parsed.value;
  }
  if (input.deadline !== undefined) {
    const parsed = validateDeadline(input.deadline);
    if (!parsed.ok) return { ok: false, error: parsed.error, status: 400, field: "deadline" };
    overrides.push(...appendOverride(undefined, "deadline", row.deadline ?? null, parsed.value, at).slice(-1));
    patch.deadline = parsed.value;
  }
  patch.briefOverrides = overrides;
  const next = await source.patch(row.id, patch);
  return { ok: true, duplicate: false, row: next, toast: "Brief updated." };
}

export function nextSpeaker(messages: DiscussionMessage[]): "owner" | "agent" | null {
  if (messages.length === 0) return "owner";
  return messages[messages.length - 1].author === "owner" ? "agent" : "owner";
}

export { applyPatchToRow, briefOf };
export type { BriefOverrideField };
