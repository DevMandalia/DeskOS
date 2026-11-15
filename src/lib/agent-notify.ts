import { isStaticDemo } from "@/lib/demo-mode";
import { signBody } from "@/lib/keys";
import { SlackNotifier } from "@/lib/notify/slack";
import { EmailNotifier } from "@/lib/notify/email";
import type { Agent, Decision } from "@/lib/types";
import type { Choice } from "@/lib/decide";

export type VerdictEvent = {
  type: "desk_verdict";
  decision_id: string;
  item: string;
  choice: Choice;
  note: string;
  status: string;
  at: string;
  raised_by: string | null;
  parent_agent: string | null;
  revisit_at?: string | null;
};

export function verdictEvent(
  row: Decision,
  choice: Choice,
  note: string,
  at: string,
  extra?: { revisit_at?: string | null },
): VerdictEvent {
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
  };
}

/** Per-agent HMAC webhook. There is no shared desk webhook. */
export async function notifyAgent(
  agent: Agent | null,
  event: VerdictEvent,
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
export async function notifyOwner(event: VerdictEvent): Promise<void> {
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
