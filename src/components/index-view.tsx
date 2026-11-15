import Link from "next/link";

import { decisionTags, parkRevisitLabel } from "@/components/decision-brief";
import { raisedByLabel } from "@/lib/agent-ref";
import { decisionHref, type DeskScope } from "@/lib/nav";
import { cardAge, displayTitle } from "@/lib/queue";
import type { BriefRow } from "@/lib/types";

const STATUS_SHORT: Record<string, string> = {
  "Waiting on you": "Waiting",
  "In flight": "In flight",
  Parked: "Parked",
  Done: "Done",
  Declined: "Declined",
};

/**
 * One desk card: the decision's title and a single quiet meta line (area and
 * age). No excerpts, chips or badges; the decision page has the detail.
 */
export function DeskCard({
  row,
  scope,
  now,
  showStatus = false,
}: {
  row: BriefRow;
  scope: DeskScope;
  now: Date;
  showStatus?: boolean;
}) {
  const tags = decisionTags(row);
  const meta = [
    scope.area ? null : (row.project ?? "Unassigned"),
    raisedByLabel(row.raisedBy),
    showStatus ? STATUS_SHORT[row.status ?? ""] ?? row.status : null,
    parkRevisitLabel(row),
    cardAge(row, now),
  ].filter(Boolean);
  return (
    <li>
      <Link
        href={decisionHref(row.id, scope)}
        className={`desk-card ${row.status === "Waiting on you" ? "desk-card-wait" : ""}`}
      >
        <h3 className="desk-card-title">{displayTitle(row.item)}</h3>
        <p className="desk-card-meta">{meta.join(" · ")}</p>
        {tags.length ? <p className="desk-card-tags">{tags.join(" · ")}</p> : null}
      </Link>
    </li>
  );
}

export function DeskList({
  rows,
  scope,
  now,
  label,
  emptyText,
  showStatus = false,
}: {
  rows: BriefRow[];
  scope: DeskScope;
  now: Date;
  label: string;
  emptyText: string;
  showStatus?: boolean;
}) {
  if (rows.length === 0) return <div className="empty">{emptyText}</div>;
  return (
    <ol className="desk-cards" aria-label={label}>
      {rows.map((row) => (
        <DeskCard key={row.id} row={row} scope={scope} now={now} showStatus={showStatus} />
      ))}
    </ol>
  );
}
