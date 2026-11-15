import { loadAgentStore } from "@/adapters/load";
import { publicAgent } from "@/lib/agent-ref";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await currentUser())) return Response.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  let body: { action?: string; webhook_url?: string | null };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const store = await loadAgentStore();
  if (body.action === "revoke") {
    const agent = await store.revoke(id);
    return Response.json({ agent: publicAgent(agent) });
  }
  if (body.action === "webhook") {
    const result = await store.setWebhook(id, body.webhook_url ?? null, true);
    return Response.json({
      agent: publicAgent(result.agent),
      webhook_secret: result.webhookSecret,
    });
  }
  return Response.json({ error: "unknown action" }, { status: 400 });
}
