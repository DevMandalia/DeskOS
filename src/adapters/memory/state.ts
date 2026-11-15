import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { dataDir } from "@/lib/env";
import {
  DEMO_TASK_AREAS,
  DEMO_TASK_STATUSES,
  demoAgents,
  demoBodies,
  demoDecisions,
  demoDiscussion,
  demoTasks,
} from "@/lib/seed";
import type { Agent, Decision, DeskBlock, DiscussionMessage } from "@/lib/types";
import { spansFromPlain } from "@/lib/rich";
import type { Task } from "@/lib/tasks/types";

export type MemoryState = {
  decisions: Decision[];
  tasks: Task[];
  agents: Agent[];
  discussion: DiscussionMessage[];
  bodies: Record<string, DeskBlock[] | string>;
  idempotency: string[];
  taskStatuses: string[];
  taskAreas: { name: string; color: string | null }[];
};

function blocksFromText(id: string, text: string): DeskBlock[] {
  return [
    {
      id: `${id}-p`,
      type: "paragraph",
      rich: spansFromPlain(text),
    },
  ];
}

export function freshState(): MemoryState {
  const bodies: Record<string, DeskBlock[] | string> = {};
  for (const [id, text] of Object.entries(demoBodies())) {
    bodies[id] = blocksFromText(id, text);
  }
  return {
    decisions: demoDecisions(),
    tasks: demoTasks(),
    agents: demoAgents(),
    discussion: demoDiscussion(),
    bodies,
    idempotency: [],
    taskStatuses: [...DEMO_TASK_STATUSES],
    taskAreas: DEMO_TASK_AREAS.map((a) => ({ ...a })),
  };
}

const g = globalThis as unknown as { __deskMemory?: MemoryState };

export function memoryState(): MemoryState {
  if (!g.__deskMemory) g.__deskMemory = freshState();
  return g.__deskMemory;
}

export function resetMemoryState(next?: MemoryState): MemoryState {
  g.__deskMemory = next ?? freshState();
  return g.__deskMemory;
}

export async function persistMemory(): Promise<void> {
  if (process.env.DESK_MEMORY_PERSIST !== "1") return;
  const dir = dataDir();
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, "memory.json"),
    `${JSON.stringify(memoryState(), null, 2)}\n`,
    "utf8",
  );
}

export async function loadPersistedMemory(): Promise<void> {
  if (process.env.DESK_MEMORY_PERSIST !== "1") return;
  try {
    const text = await readFile(path.join(dataDir(), "memory.json"), "utf8");
    g.__deskMemory = JSON.parse(text) as MemoryState;
  } catch {
    g.__deskMemory = freshState();
  }
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
