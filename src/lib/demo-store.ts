"use client";

import { configuredColumns, resolveColumns } from "@/lib/board";
import { STATUS } from "@/lib/decide";
import {
  DEMO_TASK_AREAS,
  DEMO_TASK_STATUSES,
  demoDecisions,
  demoDiscussion,
  demoTasks,
} from "@/lib/seed";
import type { Decision, DiscussionMessage } from "@/lib/types";
import type { Task, TaskBoard } from "@/lib/tasks/types";

const KEY = "deskos-demo-v1";

export type DemoState = {
  decisions: Decision[];
  tasks: Task[];
  discussion: DiscussionMessage[];
};

function seed(): DemoState {
  return {
    decisions: demoDecisions(),
    tasks: demoTasks(),
    discussion: demoDiscussion(),
  };
}

export function loadDemoState(): DemoState {
  if (typeof window === "undefined") return seed();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      const next = seed();
      window.localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    }
    return JSON.parse(raw) as DemoState;
  } catch {
    return seed();
  }
}

export function saveDemoState(state: DemoState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(state));
}

export function demoBoard(state: DemoState = loadDemoState()): TaskBoard {
  return {
    tasks: state.tasks,
    schema: {
      statusOptions: [...DEMO_TASK_STATUSES],
      areaOptions: DEMO_TASK_AREAS.map((a) => ({ ...a })),
    },
    columns: resolveColumns(DEMO_TASK_STATUSES, configuredColumns()),
    fetchedAt: new Date().toISOString(),
  };
}

export function recordDemoVerdict(
  id: string,
  choice: "Approve" | "Decline" | "Park" | "Discuss",
  note: string,
  extra?: { revisitAt?: string | null },
): Decision | null {
  const state = loadDemoState();
  const row = state.decisions.find((d) => d.id === id);
  if (!row) return null;
  const status =
    choice === "Approve"
      ? STATUS.inFlight
      : choice === "Decline"
        ? STATUS.declined
        : choice === "Park"
          ? STATUS.parked
          : STATUS.waiting;
  const revisit =
    choice === "Park" && extra?.revisitAt ? ` (revisit ${extra.revisitAt})` : "";
  const line = `${choice} — ${note.trim() || "(demo)"}${revisit} (via DeskOS, demo)`;
  row.reply = row.reply ? `${line}\n${row.reply}` : line;
  row.status = status;
  row.lastChoice = choice;
  row.lastUpdated = new Date().toISOString();
  row.revisitAt = choice === "Park" ? extra?.revisitAt ?? null : row.revisitAt ?? null;
  if (choice === "Discuss") {
    state.discussion.push({
      id: crypto.randomUUID(),
      decisionId: id,
      author: "owner",
      agentId: null,
      agentName: null,
      body: note.trim() || "Let's discuss this.",
      at: row.lastUpdated,
    });
  }
  saveDemoState(state);
  return row;
}

export function addDemoDiscussion(
  decisionId: string,
  body: string,
  author: "owner" | "agent" = "owner",
): void {
  const state = loadDemoState();
  state.discussion.push({
    id: crypto.randomUUID(),
    decisionId,
    author,
    agentId: null,
    agentName: author === "agent" ? "Acme Ops" : null,
    body,
    at: new Date().toISOString(),
  });
  saveDemoState(state);
}

export function upsertDemoTask(task: Task): TaskBoard {
  const state = loadDemoState();
  const i = state.tasks.findIndex((t) => t.id === task.id);
  if (i >= 0) state.tasks[i] = task;
  else state.tasks.unshift(task);
  saveDemoState(state);
  return demoBoard(state);
}
