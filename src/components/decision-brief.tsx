import { BriefOverrides } from "@/components/brief-overrides";
import {
  isIncompleteBrief,
  isOverdueYmd,
  splitReasonLabel,
  timeoutClassOn,
  timeoutNoticeTomorrow,
  todayYmd,
} from "../../contract";
import type { BriefRow } from "@/lib/types";

const DOOR_LABEL = {
  two_way: "Two-way door (reversible)",
  one_way: "One-way door (hard to reverse)",
} as const;

const COST_LABEL = {
  low: "Low",
  medium: "Medium",
  high: "High",
} as const;

export function parkRevisitLabel(
  row: Pick<BriefRow, "revisitAt" | "status" | "revisitState">,
  parkedStatus = "Parked",
): string | null {
  if (row.status !== parkedStatus) return null;
  return row.revisitAt ? `Revisit ${row.revisitAt}` : "No revisit date";
}

export function decisionTags(row: BriefRow, today = todayYmd(), waitingStatus = "Waiting on you"): string[] {
  const tags: string[] = [];
  if (row.revisitState === "expired") tags.push("Revisit");
  if (row.needsSplit) tags.push("Needs split");
  if (
    isIncompleteBrief({
      options: row.options ?? null,
      recommendation: row.recommendation ?? null,
      doorType: row.doorType ?? null,
      costOfDelay: row.costOfDelay ?? null,
      deadline: row.deadline ?? null,
    })
  ) {
    tags.push("Incomplete brief");
  }
  if (isOverdueYmd(row.deadline ?? null, today)) tags.push("Overdue");
  if (
    timeoutClassOn() &&
    timeoutNoticeTomorrow(row, today, waitingStatus, { classOn: true })
  ) {
    tags.push("Defaults tomorrow");
  }
  if (row.appliedBy === "timeout") tags.push("Default on timeout");
  if (row.costOfDelay) tags.push(`${COST_LABEL[row.costOfDelay]} delay`);
  if (row.doorType) tags.push(row.doorType === "one_way" ? "One-way" : "Two-way");
  return tags;
}

export function DecisionTags({ row, waitingStatus }: { row: BriefRow; waitingStatus?: string }) {
  const tags = decisionTags(row, todayYmd(), waitingStatus);
  if (tags.length === 0) return null;
  return (
    <ul className="decision-tags">
      {tags.map((tag) => (
        <li key={tag} className="decision-tag">
          {tag}
        </li>
      ))}
    </ul>
  );
}

/** Brief fields above the verdict buttons. */
export function DecisionBrief({
  row,
  essentialsOnly = false,
  waitingStatus = "Waiting on you",
}: {
  row: BriefRow;
  essentialsOnly?: boolean;
  waitingStatus?: string;
}) {
  const park = parkRevisitLabel(row);
  const def = row.defaultIfNoAnswer;
  const showDefault = Boolean(def && row.deadline);
  if (essentialsOnly) {
    if (row.revisitState === "expired") {
      return (
        <div className="decision-brief decision-brief-lite">
          <p className="decision-brief-note">
            Revisit — date passed{row.revisitAt ? ` (${row.revisitAt})` : ""}.
          </p>
        </div>
      );
    }
    return (
      <div className="decision-brief decision-brief-lite">
        <DecisionTags row={row} waitingStatus={waitingStatus} />
        {row.doorType || row.costOfDelay || row.deadline ? (
          <dl>
            {row.doorType ? (
              <div className="decision-brief-row">
                <dt>Door</dt>
                <dd>{DOOR_LABEL[row.doorType]}</dd>
              </div>
            ) : null}
            {row.costOfDelay ? (
              <div className="decision-brief-row">
                <dt>Cost of delay</dt>
                <dd>{COST_LABEL[row.costOfDelay]}</dd>
              </div>
            ) : null}
            {row.deadline ? (
              <div className="decision-brief-row">
                <dt>Deadline</dt>
                <dd>{row.deadline}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
        <BriefOverrides row={row} />
      </div>
    );
  }

  return (
    <div className="decision-brief">
      <DecisionTags row={row} waitingStatus={waitingStatus} />
      {row.needsSplit ? <p className="decision-brief-note">{splitReasonLabel(row.splitReason)}</p> : null}
      {row.revisitState === "expired" ? (
        <p className="decision-brief-note">Revisit — date passed{row.revisitAt ? ` (${row.revisitAt})` : ""}.</p>
      ) : null}
      {timeoutClassOn() && timeoutNoticeTomorrow(row, todayYmd(), waitingStatus, { classOn: true }) ? (
        <p className="decision-brief-note">This will be applied tomorrow unless you decide or extend the date.</p>
      ) : null}
      {row.appliedBy === "timeout" ? (
        <p className="decision-brief-note">
          Decided in your absence{row.timeoutAppliedChoice ? ` (${row.timeoutAppliedChoice})` : ""}. Reverse this default
          to send it back to Waiting.
        </p>
      ) : null}
      <dl>
        {row.options?.length ? (
          <div className="decision-brief-row">
            <dt>Options</dt>
            <dd>
              <ol>
                {row.options.map((option) => (
                  <li key={option}>{option}</li>
                ))}
              </ol>
            </dd>
          </div>
        ) : null}
        {row.recommendation ? (
          <div className="decision-brief-row">
            <dt>Recommendation</dt>
            <dd>{row.recommendation}</dd>
          </div>
        ) : null}
        {row.doorType ? (
          <div className="decision-brief-row">
            <dt>Door</dt>
            <dd>{DOOR_LABEL[row.doorType]}</dd>
          </div>
        ) : null}
        {row.costOfDelay ? (
          <div className="decision-brief-row">
            <dt>Cost of delay</dt>
            <dd>{COST_LABEL[row.costOfDelay]}</dd>
          </div>
        ) : null}
        {row.deadline ? (
          <div className="decision-brief-row">
            <dt>Deadline</dt>
            <dd>{row.deadline}</dd>
          </div>
        ) : null}
        {showDefault && def ? (
          <div className="decision-brief-row">
            <dt>If no answer</dt>
            <dd>
              If no answer by {row.deadline}, default is {def.choice}
              {def.note ? ` — ${def.note}` : ""}.
            </dd>
          </div>
        ) : null}
        {park ? (
          <div className="decision-brief-row">
            <dt>Parked until</dt>
            <dd>{park === "No revisit date" ? park : park.replace("Revisit ", "")}</dd>
          </div>
        ) : null}
      </dl>
      <BriefOverrides row={row} />
    </div>
  );
}
