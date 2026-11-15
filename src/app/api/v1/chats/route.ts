import { isAgent, requireAgent } from "@/app/api/v1/auth";
import { agentRef } from "@/lib/agent-ref";
import { loadAgentStore } from "@/adapters/load";
import {
  findChatByNormalizedUrl,
  parseAddChat,
  parseChatRevisitDays,
  snakeChat,
  todayYmd,
  type ChatPointer,
} from "@/lib/desk-contract";
import { deskTimezone } from "@/lib/env";
import { listChatPointers, saveChatPointer } from "@/lib/chats/store";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

function visibleTo(
  chats: ChatPointer[],
  agent: { id: string; role: string; parentId: string | null } | null,
): ChatPointer[] {
  if (!agent) return chats;
  return chats.filter((chat) => {
    if (!chat.raisedBy) return agent.role === "lead";
    if (chat.raisedBy.id === agent.id) return true;
    if (agent.role === "lead" && chat.raisedBy.id) return chat.raisedBy.id === agent.id;
    return false;
  });
}

export async function GET(request: Request) {
  const user = await currentUser();
  const chats = await listChatPointers();
  if (user) {
    return Response.json({ chats: chats.map(snakeChat) });
  }
  const agent = await requireAgent(request);
  if (!isAgent(agent)) return agent;
  return Response.json({ chats: visibleTo(chats, agent).map(snakeChat) });
}

export async function POST(request: Request) {
  const user = await currentUser();
  let agent = null;
  if (!user) {
    const auth = await requireAgent(request);
    if (!isAgent(auth)) return auth;
    agent = auth;
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const today = todayYmd(new Date(), deskTimezone());
  const parsed = parseAddChat(body, { today, revisitDays: parseChatRevisitDays() });
  if (!parsed.ok) {
    return Response.json({ error: parsed.error, field: parsed.field, code: "invalid_field" }, { status: 400 });
  }
  const existing = findChatByNormalizedUrl(await listChatPointers(), parsed.value.normalizedUrl);
  if (existing) {
    return Response.json({ chat: snakeChat(existing), existing: true });
  }
  const now = new Date().toISOString();
  let raisedBy = null;
  if (agent) {
    const agents = await loadAgentStore();
    const parent = agent.parentId ? await agents.get(agent.parentId) : null;
    raisedBy = agentRef(agent, parent);
  }
  const chat: ChatPointer = {
    id: crypto.randomUUID(),
    url: parsed.value.url,
    normalizedUrl: parsed.value.normalizedUrl,
    app: parsed.value.app,
    title: parsed.value.title,
    nextStep: parsed.value.nextStep,
    comeBackBy: parsed.value.comeBackBy,
    status: "open",
    ephemeral: parsed.value.ephemeral,
    note: parsed.value.note,
    linkKind: parsed.value.linkKind,
    linkDead: false,
    convertedToType: null,
    convertedToId: null,
    missedCount: 0,
    createdAt: now,
    lastUpdated: now,
    raisedBy,
  };
  await saveChatPointer(chat);
  return Response.json({ chat: snakeChat(chat) }, { status: 201 });
}
