import { SlackNotifier } from "@/lib/notify/slack";
import type { Notifier, NotifyEvent } from "@/lib/notify/types";
import { WebhookNotifier } from "@/lib/notify/webhook";

/**
 * Optional email notifier. Set NOTIFY_EMAIL_TO and NOTIFY_EMAIL_FROM.
 * Delivery uses NOTIFY_EMAIL_WEBHOOK_URL (a transactional-email HTTP API)
 * so this repo does not ship an SMTP stack.
 */
export class EmailNotifier implements Notifier {
  readonly label = "email";

  constructor(
    private readonly opts: {
      to: string;
      from: string;
      webhookUrl: string;
      fetchImpl?: typeof fetch;
    },
  ) {}

  async notify(event: NotifyEvent): Promise<void> {
    if (!this.opts.to || !this.opts.webhookUrl) return;
    const subject =
      event.type === "desk_decision"
        ? `[DeskOS] ${String(event.choice ?? "Update")}: ${String(event.item ?? "")}`
        : `[DeskOS] ${event.type}`;
    try {
      await (this.opts.fetchImpl ?? fetch)(this.opts.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: this.opts.to,
          from: this.opts.from,
          subject,
          text: JSON.stringify(event, null, 2),
        }),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      console.warn("email notifier failed");
    }
  }
}

export function loadNotifiers(): Notifier[] {
  const list: Notifier[] = [new WebhookNotifier()];
  const slack = (process.env.SLACK_WEBHOOK_URL ?? "").trim();
  if (slack) list.push(new SlackNotifier(slack));
  const emailTo = (process.env.NOTIFY_EMAIL_TO ?? "").trim();
  const emailHook = (process.env.NOTIFY_EMAIL_WEBHOOK_URL ?? "").trim();
  if (emailTo && emailHook) {
    list.push(
      new EmailNotifier({
        to: emailTo,
        from: (process.env.NOTIFY_EMAIL_FROM ?? "").trim() || "desk@localhost",
        webhookUrl: emailHook,
      }),
    );
  }
  return list;
}
