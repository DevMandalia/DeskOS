"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import { BoardView } from "@/components/board-view";
import { DecisionPanel } from "@/components/decision-panel";
import { DeskList } from "@/components/index-view";
import { demoBanner } from "@/lib/demo-mode";
import { demoBoard, loadDemoState } from "@/lib/demo-store";
import { BOARD_HREF, VIEW_LABEL, decisionHref, deskHref, parseView, scopeRows, viewFromSlug, type DeskScope } from "@/lib/nav";
import { boardToday } from "@/lib/board";
import { cardAge, deskOrder, displayTitle, waitingQueue } from "@/lib/queue";
import { DEMO_DECISION_IDS } from "@/lib/seed";
import { raisedByLabel } from "@/lib/agent-ref";
import type { BriefRow } from "@/lib/types";

function useDemoRows(): BriefRow[] {
  return useMemo(() => loadDemoState().decisions, []);
}

export function DemoDesk({
  page,
  decisionId,
  viewSlug,
}: {
  page: "home" | "board" | "view" | "decision" | "settings" | "signin";
  decisionId?: string;
  viewSlug?: string;
}) {
  const rows = useDemoRows();
  const pathname = usePathname();
  const scope: DeskScope = {
    area: null,
    view: viewFromSlug(viewSlug ?? "") ?? parseView(null),
    includeDone: false,
  };

  if (page === "signin") {
    return (
      <main className="signin-screen">
        <section className="signin-card">
          <p className="kicker">Demo</p>
          <h1 className="signin-title">Decision Desk</h1>
          <p className="signin-subtitle">{demoBanner()}</p>
          <p>
            <Link href="/" className="btn btn-approve signin-btn">
              Open the sample desk
            </Link>
          </p>
        </section>
      </main>
    );
  }

  return (
    <>
      <p className="kicker muted" style={{ padding: "8px 0" }}>
        {demoBanner()}
      </p>
      {page === "home" ? <DemoHome rows={rows} /> : null}
      {page === "board" ? (
        <BoardView initial={demoBoard()} initialError={null} today={boardToday()} storeLabel="Demo board (localStorage)" />
      ) : null}
      {page === "view" ? <DemoView rows={rows} scope={scope} /> : null}
      {page === "decision" && decisionId ? <DemoDecision rows={rows} id={decisionId} scope={scope} /> : null}
      {page === "settings" ? (
        <div className="desk">
          <h1>Settings</h1>
          <p className="desk-sub">Agent API keys are disabled in the static demo.</p>
        </div>
      ) : null}
      <span className="sr-only">{pathname}</span>
    </>
  );
}

function DemoHome({ rows }: { rows: BriefRow[] }) {
  const waiting = waitingQueue(rows);
  return (
    <div className="home">
      <header className="desk-head">
        <h1>Home</h1>
        <p className="home-lede">
          {waiting.length === 0
            ? "Nothing is waiting on you right now."
            : `${waiting.length} ${waiting.length === 1 ? "decision is" : "decisions are"} waiting on you.`}
        </p>
        {waiting[0] ? (
          <p className="home-cta">
            <Link href={decisionHref(waiting[0].id, { view: "waiting" })} className="home-cta-btn">
              Start with the oldest →
            </Link>
          </p>
        ) : null}
      </header>
      <section className="home-section">
        <h2 className="home-h2">Oldest waiting on you</h2>
        <ol className="home-list">
          {waiting.slice(0, 5).map((row) => (
            <li key={row.id}>
              <Link href={decisionHref(row.id, { view: "waiting" })} className="home-item">
                <span className="home-item-title">{displayTitle(row.item)}</span>
                <span className="home-item-meta">
                  {row.project ?? "Unassigned"}
                  {raisedByLabel(row.raisedBy) ? ` · ${raisedByLabel(row.raisedBy)}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ol>
        <p className="home-more">
          <Link href={BOARD_HREF}>Your tasks are on the Board →</Link>
        </p>
      </section>
    </div>
  );
}

function DemoView({ rows, scope }: { rows: BriefRow[]; scope: DeskScope }) {
  const visible = scopeRows(rows, scope);
  const list = scope.view === "waiting" ? waitingQueue(visible) : deskOrder(visible);
  return (
    <div className="desk">
      <header className="desk-head">
        <h1>{VIEW_LABEL[scope.view]}</h1>
        <p className="desk-sub">
          {list.length} {list.length === 1 ? "decision" : "decisions"}
          {scope.view === "waiting" && list.length > 0 ? " · oldest first" : ""}
        </p>
      </header>
      <DeskList
        rows={list}
        scope={scope}
        now={new Date()}
        label={VIEW_LABEL[scope.view]}
        showStatus={scope.view === "all"}
        emptyText={`Nothing ${VIEW_LABEL[scope.view].toLowerCase()}.`}
      />
    </div>
  );
}

function DemoDecision({ rows, id, scope }: { rows: BriefRow[]; id: string; scope: DeskScope }) {
  const [, setTick] = useState(0);
  const row = rows.find((r) => r.id === id) ?? loadDemoState().decisions.find((r) => r.id === id);
  if (!row) {
    return (
      <div className="desk">
        <p>That sample decision is not in this demo.</p>
        <Link href={deskHref({ view: "waiting" })}>Back to Waiting</Link>
      </div>
    );
  }
  const ordered = deskOrder(scopeRows(rows, scope));
  const index = ordered.findIndex((r) => r.id === row.id);
  const prev = ordered[index - 1];
  const next = ordered[index + 1];
  const meta = [
    row.project ?? "Unassigned",
    raisedByLabel(row.raisedBy) ? `Raised by ${raisedByLabel(row.raisedBy)}` : null,
    cardAge(row, new Date()),
  ].filter(Boolean);
  return (
    <article className="decision">
      <nav className="crumb">
        <Link href={deskHref(scope)}>← {VIEW_LABEL[scope.view]}</Link>
      </nav>
      <h1 className="decision-title">{displayTitle(row.item)}</h1>
      <p className="decision-meta">{meta.join(" · ")}</p>
      <section className="verdict" aria-label="Decision needed">
        <p className="kicker">Decision needed</p>
        <p className="verdict-need">{row.decisionNeeded ?? "No decision text on this row."}</p>
      </section>
      <DecisionPanel
        row={row}
        prevHref={prev ? decisionHref(prev.id, scope) : null}
        nextHref={next ? decisionHref(next.id, scope) : null}
        position={index >= 0 ? { index: index + 1, total: ordered.length } : null}
        onLocalSave={() => setTick((n) => n + 1)}
      />
    </article>
  );
}

export const DEMO_STATIC_DECISION_IDS = Object.values(DEMO_DECISION_IDS);
