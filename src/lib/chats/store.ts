import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ChatPointer } from "../../../contract";
import { dataDir, isDemoStore } from "@/lib/env";

const g = globalThis as unknown as { __deskChatPointers?: ChatPointer[] };

function cache(): ChatPointer[] {
  if (!g.__deskChatPointers) g.__deskChatPointers = [];
  return g.__deskChatPointers;
}

function filePath(): string {
  return path.join(dataDir(), "chats.json");
}

export async function listChatPointers(): Promise<ChatPointer[]> {
  if (isDemoStore() && process.env.DESK_MEMORY_PERSIST !== "1") return [...cache()];
  try {
    const raw = await readFile(filePath(), "utf8");
    const parsed = JSON.parse(raw) as ChatPointer[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [...cache()];
  }
}

async function persist(chats: ChatPointer[]): Promise<void> {
  g.__deskChatPointers = chats;
  if (isDemoStore() && process.env.DESK_MEMORY_PERSIST !== "1") return;
  await mkdir(dataDir(), { recursive: true });
  await writeFile(filePath(), `${JSON.stringify(chats, null, 2)}\n`, "utf8");
}

export async function getChatPointer(id: string): Promise<ChatPointer | null> {
  return (await listChatPointers()).find((c) => c.id === id) ?? null;
}

export async function saveChatPointer(chat: ChatPointer): Promise<ChatPointer> {
  const chats = await listChatPointers();
  const idx = chats.findIndex((c) => c.id === chat.id);
  if (idx >= 0) chats[idx] = chat;
  else chats.unshift(chat);
  await persist(chats);
  return chat;
}

export async function replaceChatPointers(chats: ChatPointer[]): Promise<void> {
  await persist(chats);
}
