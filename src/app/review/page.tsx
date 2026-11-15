import Link from "next/link";
import type { Metadata } from "next";

import { DeskFrame } from "@/components/desk-frame";
import { ReviewList } from "@/components/review-list";
import { DemoDesk } from "@/components/demo-desk";
import { isStaticDemo } from "@/lib/demo-mode";
import { STATUS } from "@/lib/decide";
import { deskTimezone } from "@/lib/env";
import {
  doingCount,
  findDoingColumn,
  parseReviewTaskDays,
  parseReviewWaitingDays,
  parseWipLimit,
  reviewDecisionBucket,
  reviewPage,
  reviewTaskBucket,
  sortReviewItems,
  todayYmd,
} from "@/lib/desk-contract";
import { listOwnerRows } from "@/lib/owner-rows";
import { demoDecisions } from "@/lib/seed";
import { requireUser } from "@/lib/session";
import { taskStore } from "@/lib/tasks/store";

export const metadata: Metadata = { title: "Review" };

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ offset?: string }> }) {
  if (isStaticDemo()) {
    return (
      <DeskFrame email="owner@acme.test" rows={demoDecisions()} scope={{ area: null, view: "waiting", includeDone: false }}>
        <DemoDesk page="home" />
      </DeskFrame>
    );
  }
  const user = await requireUser();
  const offset = Math.max(0, Number.parseInt((await searchParams).offset ?? "0", 10) || 0);
  const today = todayYmd(new Date(), deskTimezone());
  const rows = await listOwnerRows();
  const waitingDays = parseReviewWaitingDays();
  const collected = rows
    .map((row) => reviewDecisionBucket(row, today, STATUS.waiting, waitingDays))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  try {
    const board = await (await taskStore()).list();
    const taskDays = parseReviewTaskDays();
    const doing = findDoingColumn(board.columns);
    const cap = parseWipLimit();
    const over = doingCount(board.tasks, doing) - cap;
    for (const task of board.tasks) {
      const stale = reviewTaskBucket(task, today, taskDays);
      if (stale) collected.push(stale);
    }
    if (over > 0 && doing) {
      collected.push({
        id: "wip",
        kind: "wip_overflow",
        title: `${doing.label} overflow`,
        reason: `${over + cap} in progress / limit ${cap}`,
        type: "task",
      });
    }
  } catch {
    /* board optional */
  }
  const items = sortReviewItems(collected);
  const page = reviewPage(items, offset);
  const remaining = Math.max(0, items.length - offset - page.length);
  const bankruptcy = items.length > 5;

  return (
    <DeskFrame email={user.email} rows={rows} scope={{ area: null, view: "waiting", includeDone: false }}>
      <div className="desk">
        <header className="desk-head">
          <h1>{bankruptcy && offset === 0 ? "Bankruptcy pass" : "Weekly review"}</h1>
          <p className="desk-sub">
            {items.length === 0 ? "Nothing to review." : `${page.length} of ${items.length} remaining this pass. Nothing is deleted.`}
          </p>
        </header>
        <ReviewList items={page} />
        {remaining > 0 ? (
          <p className="home-more">
            <Link href={`/review?offset=${offset + page.length}`}>Load next 5 →</Link>
          </p>
        ) : null}
      </div>
    </DeskFrame>
  );
}
