import { loadAgentStore } from "@/adapters/load";
import { publicAgent } from "@/lib/agent-ref";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await currentUser())) return Response.json({ error: "forbidden" }, { status: 403 });
  const agents = await (await loadAgentStore()).list();
  return Response.json({ agents: agents.map(publicAgent) });
}

export async function POST(request: Request) {
  if (!(await currentUser())) return Response.json({ error: "forbidden" }, { status: 403 });
  let body: { name?: string; role?: "lead" | "sub"; parent_id?: string; webhook_url?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const name = (body.name ?? "").trim();
  if (!name) return Response.json({ error: "name is required" }, { status: 400 });
  const role = body.role === "sub" ? "sub" : "lead";
  const store = await loadAgentStore();
  const created = await store.create({
    name,
    role,
    parentId: role === "sub" ? (body.parent_id ?? null) : null,
    webhookUrl: body.webhook_url ?? null,
  });
  return Response.json(
    {
      agent: publicAgent(created.agent),
      api_key: created.plaintextKey,
      webhook_secret: created.webhookSecret,
    },
    { status: 201 },
  );
}
