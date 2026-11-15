import { postWebhook } from "@/lib/webhook";
import type { Notifier, NotifyEvent } from "@/lib/notify/types";

export class WebhookNotifier implements Notifier {
  readonly label = "webhook";

  async notify(event: NotifyEvent): Promise<void> {
    await postWebhook("decision", event);
  }
}
