import { NextResponse } from "next/server";

import { demoApiBlocked } from "@/lib/demo-mode";
import { executeDecision } from "@/lib/execute-decision";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = demoApiBlocked();
  if (blocked) return blocked;
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: {
    row_id?: string;
    choice?: string;
    note?: string;
    idempotency_key?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.row_id || !body.choice) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const result = await executeDecision({
    rowId: body.row_id,
    choice: body.choice,
    note: body.note ?? "",
    idempotencyKey: body.idempotency_key,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    duplicate: result.duplicate,
    toast: result.toast,
    row: result.row,
  });
}
