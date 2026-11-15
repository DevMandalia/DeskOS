# Brief Item extra properties (example template)

These names are the DeskOS / private-desk defaults. The adapter reads and writes them **only when the property already exists**. Missing properties use null/false defaults and never fail a save.

Do **not** apply this list to the live private Brief Items database until Devaang approves it.

| Property name | Notion type | Select options / notes |
| --- | --- | --- |
| Options | rich_text | One option per line (2–7). |
| Recommendation | rich_text | Free text, max 2000 chars. |
| Door type | select | `one_way`, `two_way` |
| Cost of delay | select | `high`, `medium`, `low` |
| Deadline | date | Calendar date `YYYY-MM-DD` (start only). |
| Default if no answer | select | `Approve`, `Decline`, `Park` |
| Default if no answer note | rich_text | Optional note for the default. |
| Needs split | checkbox | |
| Split reason | rich_text | `agent`, `multiple_questions`, `review_task`, or `owner_override` |
| Parent decision | rich_text | Parent decision id. |
| Split sent back at | date | Last send-back. |
| Revisit at | date | Park sunset date. |
| Revisit state | select | `scheduled`, `expired` |
| Brief overrides | rich_text | JSON array of `{ field, from, to, at, by }`. |
| Status | select | Existing options plus **`Declined`** (DeskOS). Private live Status keeps Done until this option is approved. |

Env aliases (optional): `NOTION_OPTIONS_PROP`, `NOTION_RECOMMENDATION_PROP`, `NOTION_DOOR_TYPE_PROP`, `NOTION_COST_OF_DELAY_PROP`, `NOTION_DEADLINE_PROP`, `NOTION_DEFAULT_IF_NO_ANSWER_PROP`, `NOTION_DEFAULT_IF_NO_ANSWER_NOTE_PROP`, `NOTION_NEEDS_SPLIT_PROP`, `NOTION_SPLIT_REASON_PROP`, `NOTION_PARENT_DECISION_PROP`, `NOTION_SPLIT_SENT_BACK_PROP`, `NOTION_REVISIT_AT_PROP`, `NOTION_REVISIT_STATE_PROP`, `NOTION_BRIEF_OVERRIDES_PROP`.
