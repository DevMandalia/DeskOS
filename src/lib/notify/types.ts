export type NotifyEvent = {
  type: string;
  [key: string]: unknown;
};

export interface Notifier {
  readonly label: string;
  notify(event: NotifyEvent): Promise<void>;
}

export class CompositeNotifier implements Notifier {
  readonly label = "composite";
  constructor(private readonly notifiers: Notifier[]) {}

  async notify(event: NotifyEvent): Promise<void> {
    await Promise.all(this.notifiers.map((n) => n.notify(event)));
  }
}
