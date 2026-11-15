/**
 * Notion SDK lives only in this folder. Core must not import this file.
 */
import { Client } from "@notionhq/client";

let cached: Client | null = null;

export function notionClient(): Client {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error("NOTION_TOKEN is not set");
  if (!cached) {
    cached = new Client({ auth: token, notionVersion: "2025-09-03" });
  }
  return cached;
}

export type NotionSurface = {
  dataSources: {
    query: (args: Record<string, unknown>) => Promise<{ results: unknown[]; has_more: boolean; next_cursor: string | null }>;
    retrieve: (args: Record<string, unknown>) => Promise<unknown>;
  };
  pages: {
    retrieve: (args: Record<string, unknown>) => Promise<unknown>;
    update: (args: Record<string, unknown>) => Promise<unknown>;
    create: (args: Record<string, unknown>) => Promise<unknown>;
  };
  blocks: {
    children: {
      list: (args: Record<string, unknown>) => Promise<{ results: unknown[]; has_more: boolean; next_cursor: string | null }>;
    };
  };
};

export function liveSurface(): NotionSurface {
  return notionClient() as unknown as NotionSurface;
}

export function notionPropMap() {
  return {
    title: process.env.NOTION_TITLE_PROP ?? "Item",
    status: process.env.NOTION_STATUS_PROP ?? "Status",
    area: process.env.NOTION_AREA_PROP ?? "Project",
    decision: process.env.NOTION_DECISION_PROP ?? "Decision needed",
    next: process.env.NOTION_NEXT_PROP ?? "Next step",
    reply: process.env.NOTION_REPLY_PROP ?? "Reply",
    raisedBy: process.env.NOTION_RAISED_BY_PROP ?? "Raised by",
    parent: process.env.NOTION_PARENT_AGENT_PROP ?? "Parent agent",
    updated: process.env.NOTION_UPDATED_PROP ?? "Last updated",
    due: process.env.NOTION_DUE_PROP ?? "Due",
    source: process.env.NOTION_SOURCE_PROP ?? "Source",
    options: process.env.NOTION_OPTIONS_PROP ?? "Options",
    recommendation: process.env.NOTION_RECOMMENDATION_PROP ?? "Recommendation",
    doorType: process.env.NOTION_DOOR_TYPE_PROP ?? "Door type",
    costOfDelay: process.env.NOTION_COST_OF_DELAY_PROP ?? "Cost of delay",
    deadline: process.env.NOTION_DEADLINE_PROP ?? "Deadline",
    defaultChoice: process.env.NOTION_DEFAULT_IF_NO_ANSWER_PROP ?? "Default if no answer",
    defaultNote: process.env.NOTION_DEFAULT_IF_NO_ANSWER_NOTE_PROP ?? "Default if no answer note",
    needsSplit: process.env.NOTION_NEEDS_SPLIT_PROP ?? "Needs split",
    splitReason: process.env.NOTION_SPLIT_REASON_PROP ?? "Split reason",
    parentDecision: process.env.NOTION_PARENT_DECISION_PROP ?? "Parent decision",
    splitSentBack: process.env.NOTION_SPLIT_SENT_BACK_PROP ?? "Split sent back at",
    revisitAt: process.env.NOTION_REVISIT_AT_PROP ?? "Revisit at",
    revisitState: process.env.NOTION_REVISIT_STATE_PROP ?? "Revisit state",
    briefOverrides: process.env.NOTION_BRIEF_OVERRIDES_PROP ?? "Brief overrides",
  };
}

export function decisionsDataSourceId(): string {
  const id = process.env.NOTION_DECISIONS_DATA_SOURCE_ID ?? process.env.NOTION_DATA_SOURCE_ID ?? "";
  if (!id) throw new Error("NOTION_DECISIONS_DATA_SOURCE_ID is not set");
  return id;
}

export function tasksDataSourceId(): string {
  const id = process.env.NOTION_TASKS_DATA_SOURCE_ID ?? process.env.HQ_TASKS_DATA_SOURCE_ID ?? "";
  if (!id) throw new Error("NOTION_TASKS_DATA_SOURCE_ID is not set");
  return id;
}
