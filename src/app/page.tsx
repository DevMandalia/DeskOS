import Link from "next/link";
import { redirect } from "next/navigation";

import { DecisionPanel } from "@/components/decision-panel";
import { DemoDesk } from "@/components/demo-desk";
import { DeskFrame } from "@/components/desk-frame";
import { ContinueAnyway } from "@/components/session-strip";
import { isStaticDemo } from "@/lib/demo-mode";
import { STATUS } from "@/lib/decide";
import { deskTimezone } from "@/lib/env";
import { listSessionLines } from "@/lib/session-log";
import {
  defaultComeBackBy,
  defaultRevisitDate,
  doneThisWeekCount,
  parseChatRevisitDays,
  parseSessionCap,
  parseSessionChatCap,
  parkRevisitDays,
  sessionForDay,
  sessionOverdueChats,
  queueSortPhrase,
  startCtaLabel,
  timeoutClassOn,
  timeoutNoticeTomorrow,
  todayYmd,
} from "../../contract";
import { ChatRow } from "@/components/chat-lane";
import { listChatPointers } from "@/lib/chats/store";
import { CHATS_HREF, buildHome, decisionHref, legacyListHref, type DeskScope } from "@/lib/nav";
import { datePillLabel, firstName, helloPhrase } from "@/lib/greeting";
import { ageDays, agePill, cardAge, displayTitle, queueOrderHint, queueSort } from "@/lib/queue";
import { listOwnerRows } from "@/lib/owner-rows";
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
  const rows = await listOwnerRows();
  const home = buildHome(rows);
  const sort = queueSort();
  const next = home.next;
  const today = todayYmd(now, deskTimezone());
  const session = sessionForDay(await listSessionLines(), today, parseSessionCap(), deskTimezone());
  const allChats = await listChatPointers();
  const overdueChats = sessionOverdueChats(allChats, today, parseSessionChatCap());
  const snoozeDate = defaultComeBackBy(today, parseChatRevisitDays());
  const moreChats = Math.max(0, allChats.filter((c) => c.status === "open" || c.status === "resumed").length - overdueChats.length);
  const weekDone = doneThisWeekCount(rows, today, STATUS.done, deskTimezone());
  const defaultsTomorrow = timeoutClassOn()
    ? rows.filter((row) => timeoutNoticeTomorrow(row, today, STATUS.waiting, { classOn: true }))
    : [];
  const oldestDays = next ? ageDays(next.lastUpdated, now) : null;
  const oldestAge =
    oldestDays === null
      ? ""
      : oldestDays === 0
        ? " The oldest came in today."
        : ` The oldest has waited ${oldestDays} ${oldestDays === 1 ? "day" : "days"}.`;

  const name = firstName(user.name, user.email);
  const hello = helloPhrase(now, name, deskTimezone());
  const dateLabel = datePillLabel(now, deskTimezone());

  return (
    <DeskFrame email={user.email} rows={rows} scope={HOME_SCOPE} home>
      <div className="home">
        <header className="desk-head">
          <p className="date-pill">
            <span className="live-dot" aria-hidden="true" />
            {dateLabel}
          </p>
          <h1 className="home-hello">
            {hello}{" "}
            <span className="home-hello-muted">Here&apos;s what needs you.</span>
          </h1>
          <p className="home-lede">
            {home.totalWaiting === 0
              ? "Nothing is waiting on you right now."
              : `${home.totalWaiting} ${home.totalWaiting === 1 ? "decision is" : "decisions are"} waiting on you.`}
            {oldestAge}
          </p>
          {home.totalWaiting > 0 && next ? (
            <p className="home-cta">
              <Link href={decisionHref(next.id, HOME_SCOPE)} className="home-cta-btn">
                {startCtaLabel()}
              </Link>
            </p>
          ) : null}
        </header>

        <section className="home-section home-status" aria-labelledby="home-status">
          <h2 id="home-status" className="sr-only">
            At a glance
          </h2>
          <ul className="home-counts">
            {home.counts.map((c) => (
              <li key={c.view}>
                <Link href={c.href} className={`home-tile ${c.view === "waiting" ? "home-tile-wait" : ""}`}>
                  <span className="home-tile-count">{c.view === "done" ? weekDone : c.count}</span>
                  <span className="home-tile-label">{c.view === "done" ? "Done this week" : c.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="home-section" aria-labelledby="home-session">
          <h2 id="home-session" className="home-h2">
            Today
          </h2>
          <p className="desk-sub">
            {session.complete
              ? "Session complete."
              : `${session.remaining} of ${session.cap} verdicts left in this session.`}
          </p>
          {session.doneToday.length === 0 ? (
            <p className="empty">Nothing decided yet today.</p>
          ) : (
            <ol className="home-list">
              {session.doneToday.map((line, i) => (
                <li key={`${line.id}-${line.at}-${i}`}>
                  <span className="home-item-title">{line.sentence}</span>
                </li>
              ))}
            </ol>
          )}
          {overdueChats.length > 0 ? (
            <div>
              <p className="desk-sub">Overdue chats (do not count toward the verdict cap).</p>
              <ul className="home-list">
                {overdueChats.map((chat) => (
                  <ChatRow key={chat.id} chat={chat} snoozeDate={snoozeDate} />
                ))}
              </ul>
              <p className="home-more">
                {moreChats > 0 ? <Link href={CHATS_HREF}>{moreChats} more in Chats →</Link> : <Link href={CHATS_HREF}>Chats →</Link>}
              </p>
            </div>
          ) : null}
        </section>

        {defaultsTomorrow.length > 0 ? (
          <section className="home-section" aria-labelledby="home-defaults">
            <h2 id="home-defaults" className="home-h2">
              Defaults tomorrow
            </h2>
            <p className="desk-sub">If you don’t decide today, these take their stored default tomorrow.</p>
            <ol className="home-list">
              {defaultsTomorrow.map((row) => (
                <li key={row.id}>
                  <Link href={decisionHref(row.id, HOME_SCOPE)} className="home-item">
                    <span className="home-item-title">{displayTitle(row.item)}</span>
                    <span className="home-item-meta">
                      Default {row.defaultIfNoAnswer?.choice} · {row.deadline}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {next ? (
          <section className="home-section" aria-labelledby="home-top">
            <h2 id="home-top" className="home-h2">
              Next up. <span className="two-weight-muted">{queueSortPhrase(sort) === "highest-stakes" ? "Highest-stakes." : "Oldest first."}</span>
            </h2>
            <div className={`home-object ${next.revisitState === "expired" ? "home-object-revisit" : ""}`}>
              <p className="object-pills">
                <span className="pill">{next.project ?? "Unassigned"}</span>
                {agePill(next, now) ? <span className="pill">{agePill(next, now)}</span> : null}
              </p>
              <h3 className="decision-title">
                <Link href={decisionHref(next.id, HOME_SCOPE)}>{displayTitle(next.item)}</Link>
              </h3>
              <p className="verdict-need">
                <strong>Decision needed:</strong> {next.decisionNeeded ?? "No decision text on this row."}
              </p>
              {timeoutNoticeTomorrow(next, today, STATUS.waiting, { classOn: timeoutClassOn() }) ? (
                <p className="decision-brief-note">This will be applied tomorrow unless you decide or extend the date.</p>
              ) : null}
              <ContinueAnyway complete={session.complete}>
                <DecisionPanel
                  row={next}
                  prevHref={null}
                  nextHref={null}
                  defaultParkDate={defaultRevisitDate(now, parkRevisitDays())}
                />
              </ContinueAnyway>
            </div>
          </section>
        ) : null}

        {home.oldest.length > 1 ? (
          <section className="home-section" aria-labelledby="home-oldest">
            <h2 id="home-oldest" className="sr-only">
              Also waiting
            </h2>
            <ol className="home-list">
              {home.oldest.slice(1, 3).map((row) => (
                <li key={row.id}>
                  <Link href={decisionHref(row.id, HOME_SCOPE)} className="home-item">
                    <span className="home-item-title">{displayTitle(row.item)}</span>
                    <span className="home-item-meta">
                      {row.project ?? "Unassigned"}
                      {raisedByLabel(row.raisedBy) ? ` · ${raisedByLabel(row.raisedBy)}` : ""}
                    </span>
                    {agePill(row, now) ? <span className="age-pill">{agePill(row, now)}</span> : null}
                  </Link>
                </li>
              ))}
            </ol>
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
            How to use the Desk. <span className="two-weight-muted">Four habits.</span>
          </h2>
          <ol className="habits">
            <li>
              <span className="habits-n">1</span>
              <p>
                <strong>Decide.</strong> Open it, read it, press Approve, Decline or Discuss.
              </p>
            </li>
            <li>
              <span className="habits-n">2</span>
              <p>
                <strong>Move through the queue.</strong> Prev and Next, or <kbd>J</kbd> and <kbd>K</kbd>. {queueOrderHint(sort)}.
              </p>
            </li>
            <li>
              <span className="habits-n">3</span>
              <p>
                <strong>Ask the Desk agent.</strong> Only your buttons change anything.
              </p>
            </li>
            <li>
              <span className="habits-n">4</span>
              <p>
                <strong>Track to-dos on the Board.</strong> Press <kbd>N</kbd> to quick-add.
              </p>
            </li>
          </ol>
        </section>
      </div>
    </DeskFrame>
  );
}
