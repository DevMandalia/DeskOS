import { NextResponse } from "next/server";

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
    return NextResponse.json({ task: await (await taskStore()).update(id, patch) });
  } catch (err) {
    return taskError(err);
  }
}
