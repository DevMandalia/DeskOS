import Link from "next/link";
import { notFound } from "next/navigation";

import { BlockList } from "@/components/block-renderer";
import { DecisionBrief } from "@/components/decision-brief";
import { DecisionPanel } from "@/components/decision-panel";
import { DemoDesk } from "@/components/demo-desk";
import { DeskFrame } from "@/components/desk-frame";
import { DiscussionThread } from "@/components/discussion-thread";
import { raisedByLabel } from "@/lib/agent-ref";
import { isStaticDemo } from "@/lib/demo-mode";
import { nextSpeaker } from "@/lib/execute-decision";
import {
  decisionHref,
  deskHref,
  parseView,
  scopeRows,
  VIEW_LABEL,
  type DeskScope,
} from "@/lib/nav";
import { defaultRevisitDate, parkRevisitDays } from "../../../../contract";
import { cardAge, deskOrder, displayTitle } from "@/lib/queue";
import { getRow, getRowBody, listDiscussion, listRows, neighbors } from "@/lib/rows";
import { DEMO_DECISION_IDS, demoDecisions } from "@/lib/seed";
import { requireUser } from "@/lib/session";

export function generateStaticParams() {
  return Object.values(DEMO_DECISION_IDS).map((id) => ({ id }));
}

export default async function DecisionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ area?: string; done?: string; view?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const scope: DeskScope = {
    area: query.area ?? null,
    view: parseView(query.view),
    includeDone: query.done === "1",
  };

  if (isStaticDemo()) {
    return (
      <DeskFrame email="owner@acme.test" rows={demoDecisions()} scope={scope} currentId={id}>
        <DemoDesk page="decision" decisionId={id} />
      </DeskFrame>
    );
  }

  const user = await requireUser();
  const area = scope.area;
  const row = await getRow(id);
  if (!row) notFound();

  const rows = await listRows();
  const ordered = deskOrder(scopeRows(rows, scope));
  const { prev, next } = neighbors(ordered, row.id);
  const index = ordered.findIndex((r) => r.id === row.id);
  const hrefFor = (target: string) => decisionHref(target, scope);
  const blocks = await getRowBody(row);
  const thread = await listDiscussion(row.id);
  const closed = row.lastChoice === "Approve" || row.lastChoice === "Decline";
  const meta = [
    row.project ?? "Unassigned",
    raisedByLabel(row.raisedBy) ? `Raised by ${raisedByLabel(row.raisedBy)}` : null,
    cardAge(row, new Date()),
  ].filter(Boolean);

  return (
    <DeskFrame email={user.email} rows={rows} scope={scope} currentId={row.id}>
      <article className="decision">
        <nav className="crumb" aria-label="Breadcrumb">
          <Link href={deskHref(scope)}>
            ← {VIEW_LABEL[scope.view]}
            {area ? ` · ${area}` : ""}
          </Link>
        </nav>

        <h1 className="decision-title">{displayTitle(row.item)}</h1>
        <p className="decision-meta">{meta.join(" · ")}</p>

        <section className="verdict" aria-label="Decision needed">
          <p className="kicker">Decision needed</p>
          <p className="verdict-need">{row.decisionNeeded ?? "No decision text on this row."}</p>
          {row.nextStep ? (
            <p className="verdict-next">
              <span className="verdict-next-label">Next step:</span> {row.nextStep}
            </p>
          ) : null}
          <DecisionBrief row={row} />
        </section>

        <DecisionPanel
          row={row}
          prevHref={prev ? hrefFor(prev.id) : null}
          nextHref={next ? hrefFor(next.id) : null}
          position={index >= 0 ? { index: index + 1, total: ordered.length } : null}
          defaultParkDate={defaultRevisitDate(new Date(), parkRevisitDays())}
        />

        <DiscussionThread
          decisionId={row.id}
          messages={thread}
          closed={closed}
          ownerTurn={!closed && (thread.length === 0 || nextSpeaker(thread) === "owner")}
        />

        {blocks.length > 0 ? (
          <section className="page-body" aria-labelledby="details-title">
            <h2 id="details-title" className="page-body-title">
              Details
            </h2>
            <BlockList blocks={blocks} />
          </section>
        ) : null}
      </article>
    </DeskFrame>
  );
}
