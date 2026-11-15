import "server-only";

import { loadAgentStore } from "@/adapters/load";
import { notifyAgent, notifyOwner, verdictEvent } from "@/lib/agent-notify";
import {
  SAVED_TOAST,
  formatIsoInZone,
  formatReply,
  isChoice,
  isDuplicateReply,
  prependReply,
  statusForChoice,
  type Choice,
} from "@/lib/decide";
import { decisionSource, getRow } from "@/lib/rows";
import type { BriefRow, DiscussionMessage } from "@/lib/types";

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
  | { ok: false; error: string; status: number };

export async function executeDecision(input: {
  rowId: string;
  choice: string;
  note: string;
  idempotencyKey?: string;
}): Promise<DecideResult> {
  if (!isChoice(input.choice)) {
    return { ok: false, error: "Unknown choice", status: 400 };
  }
  const choice: Choice = input.choice;
  const source = await decisionSource();
  const row = await getRow(input.rowId);
  if (!row) return { ok: false, error: "Row not found", status: 404 };

  const key = input.idempotencyKey ?? "";
  if (key && rememberKey(key)) {
    return { ok: true, duplicate: true, row, toast: SAVED_TOAST };
  }
  if (key && source.hasIdempotencyKey && (await source.hasIdempotencyKey(key))) {
    return { ok: true, duplicate: true, row, toast: SAVED_TOAST };
  }
  if (isDuplicateReply(row.reply, choice, input.note)) {
    return { ok: true, duplicate: true, row, toast: SAVED_TOAST };
  }

  const at = new Date();
  const iso = formatIsoInZone(at);
  const line = formatReply(choice, input.note, at);
  const reply = prependReply(row.reply, line);
  const status = statusForChoice(choice);
  const lastUpdated = at.toISOString();

  const next = await source.recordVerdict(row.id, {
    choice,
    note: input.note,
    reply,
    status,
    lastUpdated,
  });
  if (key && source.rememberIdempotencyKey) await source.rememberIdempotencyKey(key);

  if (choice === "Discuss") {
    const message: Omit<DiscussionMessage, "id"> = {
      decisionId: row.id,
      author: "owner",
      agentId: null,
      agentName: null,
      body: input.note.trim() || "Let's discuss this.",
      at: lastUpdated,
    };
    await source.addDiscussion(message);
  }

  const event = verdictEvent(next, choice, input.note.trim(), iso);
  if (choice !== "Discuss" && next.raisedBy) {
    const agents = await loadAgentStore();
    const agent = await agents.get(next.raisedBy.id);
    await notifyAgent(agent, event);
  }
  await notifyOwner(event);

  const toast =
    choice === "Discuss"
      ? "Saved. The item stays open — reply in the thread."
      : SAVED_TOAST;
  return { ok: true, duplicate: false, row: next, toast };
}

export function nextSpeaker(messages: DiscussionMessage[]): "owner" | "agent" | null {
  if (messages.length === 0) return "owner";
  return messages[messages.length - 1].author === "owner" ? "agent" : "owner";
}
