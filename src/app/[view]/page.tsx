import Link from "next/link";
import { notFound } from "next/navigation";

import { DemoDesk } from "@/components/demo-desk";
import { DeskFrame } from "@/components/desk-frame";
import { DeskList } from "@/components/index-view";
import { isStaticDemo } from "@/lib/demo-mode";
import { deskHref, scopeRows, VIEW_LABEL, VIEW_SLUG, viewFromSlug, type DeskScope } from "@/lib/nav";
import { queueHeadline } from "../../../contract";
import { deskOrder, parkedQueue, queueOrderHint, queueSort, waitingAreaCounts, waitingQueue } from "@/lib/queue";
import { listOwnerRows } from "@/lib/owner-rows";
import { demoDecisions } from "@/lib/seed";
import { requireUser } from "@/lib/session";

export function generateStaticParams() {
  return Object.values(VIEW_SLUG).map((view) => ({ view }));
}

export default async function ViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ view: string }>;
  searchParams: Promise<{ area?: string; done?: string }>;
}) {
  const slug = (await params).view;
  const view = viewFromSlug(slug);
  if (!view) notFound();

  if (isStaticDemo()) {
    return (
      <DeskFrame
        email="owner@acme.test"
        rows={demoDecisions()}
        scope={{ area: null, view, includeDone: false }}
      >
        <DemoDesk page="view" viewSlug={slug} />
      </DeskFrame>
    );
  }

  const user = await requireUser();
  const query = await searchParams;
  const scope: DeskScope = {
    area: query.area ?? null,
    view,
    includeDone: query.done === "1",
  };
  const now = new Date();
  const all = await listOwnerRows();
  const visible = scopeRows(all, scope);
  const sort = queueSort();
  const rows =
    scope.view === "waiting"
      ? waitingQueue(visible)
      : scope.view === "parked"
        ? parkedQueue(visible)
        : deskOrder(visible);
  const label = VIEW_LABEL[scope.view];
  const noun = scope.view === "waiting" ? "decision" : "item";
  const where = scope.area ? ` in ${scope.area}` : "";
  const orderHint =
    scope.view === "waiting" && rows.length > 0
      ? ` · ${queueOrderHint(sort)}`
      : scope.view === "parked" && rows.length > 0
        ? " · by revisit date"
        : "";
  const waitingAll = scope.view === "waiting" ? waitingQueue(scopeRows(all, { area: null, view: "waiting", includeDone: false })) : [];
  const headline = scope.view === "waiting" ? queueHeadline(sort, rows.length) : null;
  const areas = scope.view === "waiting" ? waitingAreaCounts(waitingAll) : [];

  return (
    <DeskFrame email={user.email} rows={all} scope={scope}>
      <div className="desk">
        <header className="desk-head">
          {headline ? (
            <h1 className="home-hello">
              {headline.lead} <span className="home-hello-muted">{headline.rest}</span>
            </h1>
          ) : (
            <h1>{label}</h1>
          )}
          {headline ? null : (
            <p className="desk-sub">
              {rows.length} {rows.length === 1 ? noun : `${noun}s`}
              {where}
              {orderHint}
              {scope.area ? (
                <>
                  {" · "}
                  <Link href={deskHref({ ...scope, area: null })}>All areas</Link>
                </>
              ) : null}
            </p>
          )}
        </header>
        {headline ? (
          <div className="queue-pills" role="navigation" aria-label="Areas">
            <Link
              href={deskHref({ ...scope, area: null })}
              className={`queue-pill ${scope.area ? "" : "queue-pill-on"}`}
            >
              All {waitingAll.length}
            </Link>
            {areas.map((area) => (
              <Link
                key={area.area}
                href={deskHref({ ...scope, area: area.area })}
                className={`queue-pill ${scope.area === area.area ? "queue-pill-on" : ""}`}
              >
                {area.area}
              </Link>
            ))}
          </div>
        ) : null}
        {scope.view === "done" ? (
          <>
            <h2 className="home-h2">Done</h2>
            <DeskList
              rows={rows.filter((row) => row.status === "Done")}
              scope={scope}
              now={now}
              label="Done"
              emptyText={`Nothing done${where}.`}
            />
            <div className="done-group">
              <h2 className="home-h2">Declined</h2>
              <DeskList
                rows={rows.filter((row) => row.status === "Declined")}
                scope={scope}
                now={now}
                label="Declined"
                emptyText={`Nothing declined${where}.`}
              />
            </div>
          </>
        ) : (
          <DeskList
            rows={rows}
            scope={scope}
            now={now}
            label={label}
            showStatus={scope.view === "all"}
            emptyText={
              scope.view === "waiting"
                ? `Nothing is waiting on you${where}.`
                : `Nothing ${label.toLowerCase()}${where}.`
            }
          />
        )}
      </div>
    </DeskFrame>
  );
}
