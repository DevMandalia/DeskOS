import { snakeChat } from "@/lib/desk-contract";
import { getChatPointer, saveChatPointer } from "@/lib/chats/store";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await currentUser())) return Response.json({ error: "forbidden" }, { status: 403 });
  const chat = await getChatPointer((await params).id);
  if (!chat) return Response.json({ error: "not found" }, { status: 404 });
  chat.status = "closed";
  chat.lastUpdated = new Date().toISOString();
  await saveChatPointer(chat);
  return Response.json({ chat: snakeChat(chat) });
}
