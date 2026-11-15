import "server-only";

import { loadTaskStore } from "@/adapters/load";
import type { TaskStore } from "@/lib/tasks/types";

let cached: TaskStore | null = null;

export async function taskStore(): Promise<TaskStore> {
  if (!cached) cached = await loadTaskStore();
  return cached;
}

export function resetTaskStoreCache(): void {
  cached = null;
}
