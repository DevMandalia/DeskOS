import "server-only";

import { NextResponse } from "next/server";

import { TaskStoreError, type TaskPatch } from "@/lib/tasks/types";

const STATUS: Record<TaskStoreError["code"], number> = {
  no_access: 502,
  not_found: 404,
  invalid: 400,
  unavailable: 503,
};

export function taskError(err: unknown): NextResponse {
  if (err instanceof TaskStoreError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: STATUS[err.code] });
  }
  console.error("tasks failed", err instanceof Error ? err.name : "error");
  return NextResponse.json({ error: "Something went wrong.", code: "unavailable" }, { status: 500 });
}

/** Keep only the editable fields, with the right types. */
export function readPatch(body: unknown): TaskPatch | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const patch: TaskPatch = {};
  if (typeof b.title === "string") patch.title = b.title;
  if (typeof b.status === "string") patch.status = b.status;
  if (b.area === null || typeof b.area === "string") patch.area = (b.area as string | null) || null;
  if (b.due === null || typeof b.due === "string") patch.due = (b.due as string | null) || null;
  return Object.keys(patch).length ? patch : null;
}
