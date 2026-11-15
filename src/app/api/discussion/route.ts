import { nextSpeaker } from "@/lib/execute-decision";
import { decisionSource } from "@/lib/rows";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await currentUser())) return Response.json({ error: "forbidden" }, { status: 403 });
  let body: { decision_id?: string; message?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const id = body.decision_id ?? "";
  const text = (body.message ?? "").trim();
  if (!id || !text) return Response.json({ error: "missing fields" }, { status: 400 });
  const source = await decisionSource();
  const row = await source.get(id);
  if (!row) return Response.json({ error: "not found" }, { status: 404 });
  if (row.lastChoice === "Approve" || row.lastChoice === "Decline") {
    return Response.json({ error: "this decision is closed" }, { status: 409 });
  }
  const thread = await source.listDiscussion(row.id);
  if (thread.length > 0 && nextSpeaker(thread) !== "owner") {
    return Response.json({ error: "waiting for the agent" }, { status: 409 });
  }
  const message = await source.addDiscussion({
    decisionId: row.id,
    author: "owner",
    agentId: null,
    agentName: null,
    body: text,
    at: new Date().toISOString(),
  });
  return Response.json({ message }, { status: 201 });
}
