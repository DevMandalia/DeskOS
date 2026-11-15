import { NextResponse } from "next/server";

import { findDoingColumn, parseWipEnforce, wipMoveCheck } from "@/lib/desk-contract";
import { currentUser } from "@/lib/session";
import { readPatch, taskError } from "@/lib/tasks/http";
import { taskStore } from "@/lib/tasks/store";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await currentUser())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "bad id" }, { status: 400 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const patch = readPatch(body);
  if (!patch) return NextResponse.json({ error: "Nothing to change.", code: "invalid" }, { status: 400 });
  try {
    const store = await taskStore();
    if (patch.status && parseWipEnforce() === "block") {
      const board = await store.list();
      const doing = findDoingColumn(board.columns);
      const check = wipMoveCheck(board.tasks, id, patch.status, doing);
      if (check.over) {
        return NextResponse.json(
          { error: `${check.nextCount - 1} are already in progress. Move one out first.`, code: "wip" },
          { status: 409 },
        );
      }
    }
    return NextResponse.json({ task: await store.update(id, patch) });
  } catch (err) {
    return taskError(err);
  }
}
