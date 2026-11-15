import { briefHasContent } from "../../contract";
import type { BriefRow } from "@/lib/types";

const DOOR_LABEL = {
  two_way: "Two-way door (reversible)",
  one_way: "One-way door (hard to reverse)",
} as const;

const COST_LABEL = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
} as const;

export function parkRevisitLabel(row: Pick<BriefRow, "revisitAt" | "status">, parkedStatus = "Parked"): string | null {
  if (row.status !== parkedStatus) return null;
  return row.revisitAt ? `Revisit ${row.revisitAt}` : "no date";
}

/** Brief fields above the verdict buttons. Hidden when the raise had none. */
export function DecisionBrief({ row }: { row: BriefRow }) {
  const has = briefHasContent({
    kind: row.kind ?? null,
    options: row.options ?? null,
    recommendation: row.recommendation ?? null,
    door: row.door ?? null,
    costOfDelay: row.costOfDelay ?? null,
    defaultIfTimeout: row.defaultIfTimeout ?? null,
    deadline: row.deadline ?? null,
    parentId: row.parentDecisionId ?? null,
    revisitAt: row.revisitAt ?? null,
  });
  const park = parkRevisitLabel(row);
  if (!has && !park) return null;

  return (
    <dl className="decision-brief">
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
      {row.door ? (
        <div className="decision-brief-row">
          <dt>Door</dt>
          <dd>{DOOR_LABEL[row.door]}</dd>
        </div>
      ) : null}
      {row.costOfDelay ? (
        <div className="decision-brief-row">
          <dt>Cost of delay</dt>
          <dd>{COST_LABEL[row.costOfDelay]}</dd>
        </div>
      ) : null}
      {row.defaultIfTimeout ? (
        <div className="decision-brief-row">
          <dt>Default if no answer</dt>
          <dd>{row.defaultIfTimeout}</dd>
        </div>
      ) : null}
      {row.deadline ? (
        <div className="decision-brief-row">
          <dt>Deadline</dt>
          <dd>{row.deadline}</dd>
        </div>
      ) : null}
      {park ? (
        <div className="decision-brief-row">
          <dt>Parked until</dt>
          <dd>{park === "no date" ? "no date" : park.replace("Revisit ", "")}</dd>
        </div>
      ) : null}
    </dl>
  );
}
