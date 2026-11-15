import { NextResponse } from "next/server";

import { batchEligible, parseSessionCap, sessionForDay, todayYmd } from "@/lib/desk-contract";
import { demoApiBlocked } from "@/lib/demo-mode";
import { STATUS } from "@/lib/decide";
import { deskTimezone } from "@/lib/env";
import { executeDecision } from "@/lib/execute-decision";
import { getOwnerRow } from "@/lib/owner-rows";
import { currentUser } from "@/lib/session";
import { listSessionLines } from "@/lib/session-log";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = demoApiBlocked();
  if (blocked) return blocked;
  if (!(await currentUser())) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { ids?: string[]; choice?: string; note?: string; revisit_at?: string | null; continue_anyway?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];
  const choice = body.choice ?? "";
  if (!ids.length || (choice !== "Approve" && choice !== "Decline" && choice !== "Park")) {
    return NextResponse.json({ error: "ids and choice are required" }, { status: 400 });
  }

  const rows = [];
  for (const id of ids) {
    const row = await getOwnerRow(id);
    if (!row || !batchEligible(row, STATUS.waiting)) {
      return NextResponse.json({ error: "Every id must be a two-way, low-stakes waiting decision.", code: "ineligible" }, { status: 400 });
    }
    rows.push(row);
  }

  const today = todayYmd(new Date(), deskTimezone());
  const session = sessionForDay(await listSessionLines(), today, parseSessionCap(), deskTimezone());
  if (session.remaining < ids.length && !body.continue_anyway) {
    return NextResponse.json(
      { error: "This batch would pass the session cap.", code: "session_cap", remaining: session.remaining },
      { status: 409 },
    );
  }

  const applied = [];
  for (const row of rows) {
    const result = await executeDecision({
      rowId: row.id,
      choice,
      note: body.note ?? "",
      revisitAt: body.revisit_at,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    applied.push(result.row.id);
  }
  return NextResponse.json({ ok: true, applied });
}
