import Link from "next/link";
import { notFound } from "next/navigation";

import { DemoDesk } from "@/components/demo-desk";
import { DeskFrame } from "@/components/desk-frame";
import { DeskList } from "@/components/index-view";
import { isStaticDemo } from "@/lib/demo-mode";
import { deskHref, scopeRows, VIEW_LABEL, VIEW_SLUG, viewFromSlug, type DeskScope } from "@/lib/nav";
import { deskOrder, waitingQueue } from "@/lib/queue";
import { listRows } from "@/lib/rows";
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
  const all = await listRows();
  const visible = scopeRows(all, scope);
  const rows = scope.view === "waiting" ? waitingQueue(visible) : deskOrder(visible);
  const label = VIEW_LABEL[scope.view];
  const noun = scope.view === "waiting" ? "decision" : "item";
  const where = scope.area ? ` in ${scope.area}` : "";

  return (
    <DeskFrame email={user.email} rows={all} scope={scope}>
      <div className="desk">
        <header className="desk-head">
          <h1>{label}</h1>
          <p className="desk-sub">
            {rows.length} {rows.length === 1 ? noun : `${noun}s`}
            {where}
            {scope.view === "waiting" && rows.length > 0 ? " · oldest first" : ""}
            {scope.area ? (
              <>
                {" · "}
                <Link href={deskHref({ ...scope, area: null })}>All areas</Link>
              </>
            ) : null}
          </p>
        </header>
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
      </div>
    </DeskFrame>
  );
}
