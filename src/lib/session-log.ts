import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { dataDir, isDemoStore } from "@/lib/env";
import type { SessionLine } from "../../contract";

const g = globalThis as unknown as { __deskSessionLog?: SessionLine[] };

function cache(): SessionLine[] {
  if (!g.__deskSessionLog) g.__deskSessionLog = [];
  return g.__deskSessionLog;
}

function filePath(): string {
  return path.join(dataDir(), "session-log.json");
}

export async function listSessionLines(): Promise<SessionLine[]> {
  if (isDemoStore() && process.env.DESK_MEMORY_PERSIST !== "1") return [...cache()];
  try {
    const raw = await readFile(filePath(), "utf8");
    const parsed = JSON.parse(raw) as SessionLine[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [...cache()];
  }
}

export async function appendSessionLine(line: SessionLine): Promise<void> {
  const lines = await listSessionLines();
  lines.push(line);
  g.__deskSessionLog = lines;
  if (isDemoStore() && process.env.DESK_MEMORY_PERSIST !== "1") return;
  await mkdir(dataDir(), { recursive: true });
  await writeFile(filePath(), `${JSON.stringify(lines, null, 2)}\n`, "utf8");
}
