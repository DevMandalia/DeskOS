import Link from "next/link";
import { redirect } from "next/navigation";

import { DecisionBrief } from "@/components/decision-brief";
import { DecisionPanel } from "@/components/decision-panel";
import { DemoDesk } from "@/components/demo-desk";
import { DeskFrame } from "@/components/desk-frame";
import { isStaticDemo } from "@/lib/demo-mode";
import { defaultRevisitDate, parkRevisitDays, startCtaLabel, waitingListLabel } from "../../contract";
import { BOARD_HREF, buildHome, decisionHref, deskHref, legacyListHref, type DeskScope } from "@/lib/nav";
import { ageDays, cardAge, displayTitle, queueOrderHint, queueSort } from "@/lib/queue";
import { listRows } from "@/lib/rows";
import { demoDecisions } from "@/lib/seed";
import { requireUser } from "@/lib/session";
import { raisedByLabel } from "@/lib/agent-ref";

const HOME_SCOPE: DeskScope = { area: null, view: "waiting", includeDone: false };

const STATUS_WORD: Record<string, string> = {
  "Waiting on you": "Waiting on you",
  "In flight": "In flight",
  Parked: "Parked",
  Done: "Done",
  Declined: "Declined",
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; done?: string; view?: string }>;
}) {
  if (isStaticDemo()) {
    return (
      <DeskFrame email="owner@acme.test" rows={demoDecisions()} scope={HOME_SCOPE} home>
        <DemoDesk page="home" />
      </DeskFrame>
    );
  }

  const user = await requireUser();
  const legacy = legacyListHref(await searchParams);
  if (legacy) redirect(legacy);

  const now = new Date();
  const rows = await listRows();
  const home = buildHome(rows);
  const sort = queueSort();
  const next = home.next;
  const oldestDays = next ? ageDays(next.lastUpdated, now) : null;
  const oldestAge =
    oldestDays === null
      ? ""
      : oldestDays === 0
        ? " The oldest came in today."
        : ` The oldest has waited ${oldestDays} ${oldestDays === 1 ? "day" : "days"}.`;

  return (
    <DeskFrame email={user.email} rows={rows} scope={HOME_SCOPE} home>
      <div className="home">
        <header className="desk-head">
          <h1>Home</h1>
          <p className="home-lede">
            {home.totalWaiting === 0
              ? "Nothing is waiting on you right now."
              : `${home.totalWaiting} ${home.totalWaiting === 1 ? "decision is" : "decisions are"} waiting on you.`}
            {oldestAge}
          </p>
          {home.totalWaiting > 0 && next ? (
            <p className="home-cta">
              <Link href={decisionHref(next.id, HOME_SCOPE)} className="home-cta-btn">
                {startCtaLabel(sort)} →
              </Link>
              <a href="#how-to-use" className="home-cta-link">
                How to use the desk
              </a>
            </p>
          ) : null}
        </header>

        <section className="home-section" aria-labelledby="home-status">
          <h2 id="home-status" className="home-h2">
            At a glance
          </h2>
          <ul className="home-tiles">
            {home.counts.map((c) => (
              <li key={c.view}>
                <Link href={c.href} className={`home-tile ${c.view === "waiting" ? "home-tile-wait" : ""}`}>
                  <span className="home-tile-count">{c.count}</span>
                  <span className="home-tile-label">{c.label}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="home-more">
            <Link href={BOARD_HREF}>Your tasks are on the Board →</Link>
          </p>
        </section>

        {next ? (
          <section
            className={`home-object ${next.revisitState === "expired" ? "home-object-revisit" : ""}`}
            aria-labelledby="home-top"
          >
            <p className="kicker">{next.revisitState === "expired" ? "Revisit" : "Next up"}</p>
            <h2 id="home-top" className="decision-title">
              <Link href={decisionHref(next.id, HOME_SCOPE)}>{displayTitle(next.item)}</Link>
            </h2>
            <p className="decision-meta">
              {next.project ?? "Unassigned"}
              {raisedByLabel(next.raisedBy) ? ` · ${raisedByLabel(next.raisedBy)}` : ""} · {cardAge(next, now)}
            </p>
            <p className="verdict-need">{next.decisionNeeded ?? "No decision text on this row."}</p>
            <DecisionBrief row={next} essentialsOnly={next.revisitState !== "expired"} />
            <DecisionPanel
              row={next}
              prevHref={null}
              nextHref={null}
              defaultParkDate={defaultRevisitDate(now, parkRevisitDays())}
            />
          </section>
        ) : null}

        {home.oldest.length > 1 ? (
          <section className="home-section" aria-labelledby="home-oldest">
            <h2 id="home-oldest" className="home-h2">
              {waitingListLabel(sort)}
            </h2>
            <ol className="home-list">
              {home.oldest.slice(1, 4).map((row) => (
                <li key={row.id}>
                  <Link href={decisionHref(row.id, HOME_SCOPE)} className="home-item">
                    <span className="home-item-title">{displayTitle(row.item)}</span>
                    <span className="home-item-meta">
                      {row.project ?? "Unassigned"}
                      {raisedByLabel(row.raisedBy) ? ` · ${raisedByLabel(row.raisedBy)}` : ""}
                      {row.costOfDelay ? ` · ${row.costOfDelay} delay` : ""} · {cardAge(row, now)}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
            <p className="home-more">
              <Link href={deskHref({ view: "waiting" })}>All {home.totalWaiting} waiting on you →</Link>
            </p>
          </section>
        ) : null}

        {home.recent.length > 0 ? (
          <section className="home-section" aria-labelledby="home-recent">
            <h2 id="home-recent" className="home-h2">
              Recently updated
            </h2>
            <ol className="home-list">
              {home.recent.map((row) => (
                <li key={row.id}>
                  <Link
                    href={decisionHref(row.id, {
                      ...HOME_SCOPE,
                      view: row.status === "Waiting on you" ? "waiting" : "all",
                      includeDone: row.status === "Done" || row.status === "Declined",
                    })}
                    className="home-item"
                  >
                    <span className="home-item-title">{displayTitle(row.item)}</span>
                    <span className="home-item-meta">
                      {STATUS_WORD[row.status ?? ""] ?? row.status ?? "No status"} ·{" "}
                      {cardAge({ ...row, status: "In flight" }, now)}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <section className="home-section home-guide" id="how-to-use" aria-labelledby="home-guide">
          <h2 id="home-guide" className="home-h2">
            How to use the desk
          </h2>
          <h3 className="home-h3">Decide</h3>
          <p>Open a decision, read the brief, and press Approve, Decline, Park or Discuss. You confirm before anything is saved.</p>
          <p>
            Approve moves the item to In flight. Decline is terminal (Declined). Park defers it with a revisit
            date — nothing is deleted. Discuss keeps it waiting on you and opens a reply thread with the agent.
            Press <kbd>n</kbd> to add a note first.
          </p>
          <h3 className="home-h3">Move through the queue</h3>
          <p>
            Prev and Next step through Waiting on you, {queueOrderHint(sort)}. Keyboard: <kbd>←</kbd>{" "}
            <kbd>→</kbd> or <kbd>k</kbd> <kbd>j</kbd>, <kbd>a</kbd> <kbd>d</kbd> <kbd>p</kbd> <kbd>x</kbd> to
            approve, decline, park or discuss, <kbd>Enter</kbd> to confirm and <kbd>Esc</kbd> to cancel.
          </p>
          <h3 className="home-h3">Board</h3>
          <p>
            The <Link href={BOARD_HREF}>Board</Link> is your task store as columns you configure. Drag a card
            (or use Move), and Edit for title, area or due date. Press <kbd>N</kbd> to add a task.
          </p>
        </section>
      </div>
    </DeskFrame>
  );
}
