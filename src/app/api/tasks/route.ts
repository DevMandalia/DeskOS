import { NextResponse } from "next/server";

import { createWouldOverflow, findDoingColumn, parseWipLimit } from "@/lib/desk-contract";
import { currentUser } from "@/lib/session";
import { readPatch, taskError } from "@/lib/tasks/http";
import { taskStore } from "@/lib/tasks/store";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await currentUser())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    return NextResponse.json(await (await taskStore()).list(), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return taskError(err);
  }
}

export async function POST(request: Request) {
  if (!(await currentUser())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const patch = readPatch(body);
  if (!patch?.title || !patch.status) {
    return NextResponse.json({ error: "A task needs a title.", code: "invalid" }, { status: 400 });
  }
  try {
    const store = await taskStore();
    const board = await store.list();
    const overflow = createWouldOverflow(
      board.tasks,
      patch.status,
      findDoingColumn(board.columns),
      parseWipLimit(),
    );
    const task = await store.create({
      title: patch.title,
      status: patch.status,
      area: patch.area,
      due: patch.due,
    });
    return NextResponse.json({ task, overflow: overflow || undefined }, { status: 201 });
  } catch (err) {
    return taskError(err);
  }
}
