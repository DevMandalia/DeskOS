import { isAgent, requireAgent } from "@/app/api/v1/auth";
import { defaultComeBackBy, isYmd, parseChatRevisitDays, snakeChat, todayYmd } from "@/lib/desk-contract";
import { deskTimezone } from "@/lib/env";
import { getChatPointer, saveChatPointer } from "@/lib/chats/store";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  let agent = null;
  if (!user) {
    const auth = await requireAgent(request);
    if (!isAgent(auth)) return auth;
    agent = auth;
  }
  const { id } = await params;
  const chat = await getChatPointer(id);
  if (!chat) return Response.json({ error: "not found" }, { status: 404 });
  if (agent && chat.raisedBy && chat.raisedBy.id !== agent.id && agent.role !== "lead") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const ownerOnly = body.status === "closed" || body.status === "converted" || body.status === "resumed" || body.link_dead === true;
  if (ownerOnly && !user) return Response.json({ error: "owner only" }, { status: 403 });

  if (typeof body.title === "string") chat.title = body.title.trim().slice(0, 120) || chat.title;
  if (typeof body.next_step === "string" && body.next_step.trim()) chat.nextStep = body.next_step.trim().slice(0, 240);
  if (typeof body.note === "string" || body.note === null) chat.note = body.note ? String(body.note).slice(0, 500) : null;
  if (typeof body.come_back_by === "string") {
    if (!isYmd(body.come_back_by)) return Response.json({ error: "come_back_by must be YYYY-MM-DD", field: "come_back_by" }, { status: 400 });
    chat.comeBackBy = body.come_back_by;
  }
  if (body.status === "closed" && user) chat.status = "closed";
  if (body.status === "resumed" && user) {
    chat.status = "resumed";
    if (!body.come_back_by) chat.comeBackBy = defaultComeBackBy(todayYmd(new Date(), deskTimezone()), parseChatRevisitDays());
  }
  if (body.link_dead === true && user) chat.linkDead = true;
  if (typeof body.app === "string" && body.app.trim()) chat.app = body.app.trim().toLowerCase();
  chat.lastUpdated = new Date().toISOString();
  await saveChatPointer(chat);
  return Response.json({ chat: snakeChat(chat) });
}
