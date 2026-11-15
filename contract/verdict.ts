export const VERDICT_CHOICES = ["Approve", "Decline", "Park", "Discuss"] as const;
export type VerdictChoice = (typeof VERDICT_CHOICES)[number];

export type VerdictBucket = "in_flight" | "declined" | "parked" | "waiting";

export function isVerdictChoice(value: string): value is VerdictChoice {
  return (VERDICT_CHOICES as readonly string[]).includes(value);
}

export function verdictBucket(choice: VerdictChoice): VerdictBucket {
  if (choice === "Approve") return "in_flight";
  if (choice === "Decline") return "declined";
  if (choice === "Park") return "parked";
  return "waiting";
}

export function parseRevisitFromReply(reply: string | null | undefined): string | null {
  if (!reply) return null;
  const first = reply.split("\n")[0] ?? "";
  const match = first.match(/\brevisit (\d{4}-\d{2}-\d{2})\b/i);
  return match ? match[1] : null;
}

export function parseChoiceFromReply(
  reply: string | null | undefined,
): VerdictChoice | null {
  if (!reply) return null;
  const first = (reply.split("\n")[0] ?? "").trim();
  for (const choice of VERDICT_CHOICES) {
    if (first.startsWith(`${choice} —`) || first.startsWith(`${choice} -`)) return choice;
  }
  return null;
}

export function isTerminalChoice(choice: VerdictChoice | null | undefined): boolean {
  return choice === "Approve" || choice === "Decline" || choice === "Park";
}
