import { isStaticDemo } from "@/lib/demo-mode";
import { signBody } from "@/lib/keys";
import { SlackNotifier } from "@/lib/notify/slack";
import { EmailNotifier } from "@/lib/notify/email";
import { snakeBrief, briefFromRecord } from "../../contract";
import type { Agent, Decision } from "@/lib/types";
import type { Action } from "@/lib/decide";

export type VerdictEvent = {
  type: "desk_verdict";
  decision_id: string;
  item: string;
  choice: Action;
  note: string;
  status: string;
  at: string;
  raised_by: string | null;
  parent_agent: string | null;
  revisit_at?: string | null;
  options?: string[] | null;
  recommendation?: string | null;
  door_type?: string | null;
  cost_of_delay?: string | null;
  deadline?: string | null;
  default_if_no_answer?: { choice: string; note: string | null } | null;
  brief_overrides?: unknown;
  revisit_state?: string | null;
  needs_split?: boolean | null;
  parent_id?: string | null;
  applied_by?: "owner" | "timeout" | "auto" | null;
};

export type SplitRequestEvent = {
  type: "desk_split_request";
  decision_id: string;
  item: string;
  note: string;
  at: string;
  agent_id: string | null;
};

export type AgentEvent = VerdictEvent | SplitRequestEvent;

export function verdictEvent(
  row: Decision,
  choice: Action,
  note: string,
  at: string,
  extra?: { revisit_at?: string | null },
): VerdictEvent {
  const brief = snakeBrief(briefFromRecord(row));
  return {
    type: "desk_verdict",
    decision_id: row.id,
    item: row.item,
    choice,
    note,
    status: row.status ?? "",
    at,
    raised_by: row.raisedBy?.id ?? null,
    parent_agent: row.raisedBy?.parentId ?? null,
    revisit_at: extra?.revisit_at ?? row.revisitAt ?? null,
    options: brief.options,
    recommendation: brief.recommendation,
    door_type: brief.door_type,
    cost_of_delay: brief.cost_of_delay,
    deadline: brief.deadline,
    default_if_no_answer: brief.default_if_no_answer,
    brief_overrides: brief.brief_overrides,
    revisit_state: brief.revisit_state,
    needs_split: brief.needs_split,
    parent_id: brief.parent_id,
    applied_by: brief.applied_by ?? row.appliedBy ?? null,
  };
}

export function splitRequestEvent(row: Decision, note: string, at: string): SplitRequestEvent {
  return {
    type: "desk_split_request",
    decision_id: row.id,
    item: row.item,
    note,
    at,
    agent_id: row.raisedBy?.id ?? null,
  };
}

/** Per-agent HMAC webhook. There is no shared desk webhook. */
export async function notifyAgent(
  agent: Agent | null,
  event: AgentEvent,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (isStaticDemo()) return;
  if (!agent?.webhookUrl || !agent.webhookSecret) return;
  const body = JSON.stringify(event);
  const signature = signBody(agent.webhookSecret, body);
  try {
    await fetchImpl(agent.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Desk-Signature": `sha256=${signature}`,
      },
      body,
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    console.warn("agent webhook failed");
  }
}

/** Optional owner alert (email and/or Slack). Independent of agent webhooks. */
export async function notifyOwner(event: AgentEvent): Promise<void> {
  if (isStaticDemo()) return;
  const slack = (process.env.SLACK_WEBHOOK_URL ?? "").trim();
  if (slack) await new SlackNotifier(slack).notify(event);
  const emailTo = (process.env.NOTIFY_EMAIL_TO ?? "").trim();
  const emailHook = (process.env.NOTIFY_EMAIL_WEBHOOK_URL ?? "").trim();
  if (emailTo && emailHook) {
    await new EmailNotifier({
      to: emailTo,
      from: (process.env.NOTIFY_EMAIL_FROM ?? "").trim() || "desk@localhost",
      webhookUrl: emailHook,
    }).notify(event);
  }
}
