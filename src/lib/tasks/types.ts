/**
 * Board tasks. The Board is source-agnostic: it only talks to a TaskStore.
 * Register an adapter and select it with TASK_STORE.
 * See README "Connect your task source".
 */

import type { AgentRef } from "@/lib/types";

export type ColumnKey = string;

export type BoardColumn = {
  key: ColumnKey;
  label: string;
  /** Status value this column reads and writes, or null when the source has no matching status. */
  status: string | null;
};

export type Task = {
  id: string;
  url: string;
  title: string;
  status: string | null;
  area: string | null;
  areaColor: string | null;
  due: string | null;
  priority: string | null;
  owner: string | null;
  rank: number | null;
  lastEdited: string | null;
  raisedBy: AgentRef | null;
};

export type TaskSchema = {
  statusOptions: string[];
  areaOptions: { name: string; color: string | null }[];
};

export type TaskBoard = {
  tasks: Task[];
  schema: TaskSchema;
  columns: BoardColumn[];
  fetchedAt: string;
};

export type TaskCreate = {
  title: string;
  status: string;
  area?: string | null;
  due?: string | null;
  raisedBy?: AgentRef | null;
};

export type TaskPatch = {
  title?: string;
  status?: string;
  area?: string | null;
  due?: string | null;
};

export interface TaskStore {
  readonly label: string;
  list(): Promise<TaskBoard>;
  create(input: TaskCreate): Promise<Task>;
  update(id: string, patch: TaskPatch): Promise<Task>;
}

export class TaskStoreError extends Error {
  constructor(
    message: string,
    readonly code: "no_access" | "not_found" | "invalid" | "unavailable",
  ) {
    super(message);
    this.name = "TaskStoreError";
  }
}
