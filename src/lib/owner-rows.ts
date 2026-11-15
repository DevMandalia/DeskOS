import { applyDueTimeouts } from "@/lib/execute-decision";
import { getRow, listRows } from "@/lib/rows";
import type { BriefRow } from "@/lib/types";

export async function listOwnerRows(): Promise<BriefRow[]> {
  return applyDueTimeouts(await listRows());
}

export async function getOwnerRow(id: string): Promise<BriefRow | null> {
  const row = await getRow(id);
  if (!row) return null;
  const [next] = await applyDueTimeouts([row]);
  return next;
}
