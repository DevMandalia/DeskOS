import type { Notifier, NotifyEvent } from "@/lib/notify/types";

/**
 * Optional Slack incoming-webhook notifier. Set SLACK_WEBHOOK_URL.
 * Incoming webhooks are a Slack app feature; this is an example, not a Slack bot.
 */
export class SlackNotifier implements Notifier {
  readonly label = "slack";

  constructor(
    private readonly url: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async notify(event: NotifyEvent): Promise<void> {
    if (!this.url) return;
    const text =
      event.type === "desk_decision"
        ? `DeskOS: ${String(event.choice ?? "")} — ${String(event.item ?? "item")}`
        : `DeskOS: ${event.type}`;
    try {
      await this.fetchImpl(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      console.warn("slack notifier failed");
    }
  }
}
