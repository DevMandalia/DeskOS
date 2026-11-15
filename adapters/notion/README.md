# Optional example: Notion adapter

This folder is an **example** DecisionSource / TaskStore. It is not the default.

SQLite is the default store (`DECISION_SOURCE=sqlite`, `TASK_STORE=sqlite`). Memory is the fallback for demo and serverless. Nothing in `src/lib`, `src/app`, or `src/components` imports `@notionhq/client`.

To try it:

```
DECISION_SOURCE=notion
TASK_STORE=notion
NOTION_TOKEN=
NOTION_DECISIONS_DATA_SOURCE_ID=
NOTION_TASKS_DATA_SOURCE_ID=
```

Property names are env-driven (`NOTION_TITLE_PROP`, `NOTION_STATUS_PROP`, `NOTION_REPLY_PROP`, …). There are no hardcoded personal field names.

Optional brief properties (Options, Door type, Cost of delay, Deadline, …) are listed in `brief-item-properties.md`. The adapter reads and writes them when they exist on the data source and ignores them when they do not.

Agent API keys and discussion threads still live in the desk ledger (`DESK_LEDGER=sqlite|memory|postgres`), not in Notion.
