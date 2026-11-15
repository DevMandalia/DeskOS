import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { MemoryDecisionSource } from "@/adapters/memory/decisions";
import { MemoryTaskStore } from "@/adapters/memory/tasks";
import { freshState } from "@/adapters/memory/state";
import { NotionDecisionSource } from "@/adapters/notion/decisions";
import { NotionTaskStore } from "@/adapters/notion/tasks";
import { resetSqlite } from "@/adapters/sqlite/db";
import { createSqliteDecisionSource } from "@/adapters/sqlite/decisions";
import { createSqliteTaskStore } from "@/adapters/sqlite/tasks";
import { STATUS } from "@/lib/decide";
import type { DecisionSource } from "@/lib/types";
import type { TaskStore } from "@/lib/tasks/types";

const raised = {
  id: "agent-test",
  name: "Acme Test",
  parentId: null,
  parentName: null,
};

async function decisionContract(source: DecisionSource) {
  const created = await source.create({
    item: "Example: ship the sample?",
    decisionNeeded: "Ship the sample this week?",
    project: "Ops",
    raisedBy: raised,
  });
  expect(created.item).toBe("Example: ship the sample?");
  expect(created.status).toBe(STATUS.waiting);
  expect(created.raisedBy?.name).toBe("Acme Test");

  const listed = await source.list();
  expect(listed.some((d) => d.id === created.id)).toBe(true);

  const got = await source.get(created.id);
  expect(got?.id).toBe(created.id);

  const verdict = await source.recordVerdict(created.id, {
    choice: "Approve",
    note: "yes",
    reply: "Approve — yes (via Decision Desk, test)",
    status: STATUS.inFlight,
    lastUpdated: "2026-11-15T00:00:00.000Z",
  });
  expect(verdict.status).toBe(STATUS.inFlight);
  expect(verdict.lastChoice).toBe("Approve");

  await source.addDiscussion({
    decisionId: created.id,
    author: "owner",
    agentId: null,
    agentName: null,
    body: "Go ahead.",
    at: "2026-11-15T00:00:00.000Z",
  });
  const thread = await source.listDiscussion(created.id);
  expect(thread.map((m) => m.body)).toContain("Go ahead.");
}

async function taskContract(store: TaskStore) {
  const board = await store.list();
  expect(board.columns.length).toBeGreaterThan(0);
  const status = board.columns.find((c) => c.status)?.status ?? board.schema.statusOptions[0];
  expect(status).toBeTruthy();
  const task = await store.create({
    title: "Example: file the sample invoice",
    status: status as string,
    area: board.schema.areaOptions[0]?.name ?? null,
    raisedBy: raised,
  });
  expect(task.title).toContain("sample invoice");
  expect(task.raisedBy?.name).toBe("Acme Test");
  const moved = await store.update(task.id, { status: board.schema.statusOptions.at(-1) ?? status });
  expect(moved.id).toBe(task.id);
}

describe("DecisionSource / TaskStore contracts", () => {
  const files: string[] = [];
  afterEach(() => {
    for (const file of files) {
      try {
        resetSqlite(file);
      } catch {
        /* ignore */
      }
    }
    files.length = 0;
  });

  it("memory adapters", async () => {
    const state = freshState();
    await decisionContract(new MemoryDecisionSource(state));
    await taskContract(new MemoryTaskStore(state));
  });

  it("sqlite adapters", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "desk-"));
    const file = path.join(dir, "desk.sqlite");
    files.push(file);
    resetSqlite(file);
    await decisionContract(createSqliteDecisionSource(file));
    await taskContract(createSqliteTaskStore(file));
  });

  it("notion example adapters with mocks (no live client)", async () => {
    await decisionContract(new NotionDecisionSource({ mock: true }));
    await taskContract(new NotionTaskStore({ mock: true }));
  });
});
