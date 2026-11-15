"use server";

import { executeDecision } from "@/lib/execute-decision";
import { currentUser } from "@/lib/session";

export async function decideAction(formData: FormData) {
  const user = await currentUser();
  if (!user) return { ok: false as const, error: "forbidden", status: 403 };

  const result = await executeDecision({
    rowId: String(formData.get("row_id") ?? ""),
    choice: String(formData.get("choice") ?? ""),
    note: String(formData.get("note") ?? ""),
    idempotencyKey: String(formData.get("idempotency_key") ?? "") || undefined,
    revisitAt: String(formData.get("revisit_at") ?? "") || null,
  });
  return result;
}
