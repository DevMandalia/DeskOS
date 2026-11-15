import { STATUS } from "@/lib/decide";

const TONE: Record<string, string> = {
  [STATUS.waiting]: "badge badge-wait",
  [STATUS.inFlight]: "badge badge-flight",
  [STATUS.parked]: "badge badge-parked",
  [STATUS.done]: "badge badge-done",
};

export function StatusBadge({ status }: { status: string | null }) {
  const label = status ?? "Unknown";
  return <span className={TONE[label] ?? "badge"}>{label}</span>;
}
