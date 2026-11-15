import { loadTaskStore } from "@/adapters/load";
import { configuredColumns, quickAddStatus, resolveColumns } from "@/lib/board";
import { STATUS } from "@/lib/decide";
import { snakeChat } from "@/lib/desk-contract";
import { getChatPointer, saveChatPointer } from "@/lib/chats/store";
import { decisionSource } from "@/lib/rows";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await currentUser())) return Response.json({ error: "forbidden" }, { status: 403 });
  const chat = await getChatPointer((await params).id);
  if (!chat) return Response.json({ error: "not found" }, { status: 404 });
  let body: { to?: string };
  try {
    body = (await request.json()) as { to?: string };
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const to = body.to;
  if (to !== "task" && to !== "decision") {
    return Response.json({ error: "to must be task or decision" }, { status: 400 });
  }

  let convertedToId: string | null = null;
  if (to === "task") {
    const store = await loadTaskStore();
    const board = await store.list();
    const columns = board.columns.length ? board.columns : resolveColumns(board.schema.statusOptions, configuredColumns());
    const status = quickAddStatus(columns);
    if (!status) return Response.json({ error: "no writable status column" }, { status: 400 });
    const task = await store.create({ title: chat.title, status, due: null, area: null });
    convertedToId = task.id;
  } else {
    const row = await (await decisionSource()).create({
      item: chat.title,
      nextStep: chat.nextStep,
      source: `chat:${chat.id}`,
      status: STATUS.waiting,
    });
    convertedToId = row.id;
  }

  chat.status = "converted";
  chat.convertedToType = to;
  chat.convertedToId = convertedToId;
  chat.lastUpdated = new Date().toISOString();
  await saveChatPointer(chat);
  return Response.json({ chat: snakeChat(chat), converted_to_id: convertedToId });
}
