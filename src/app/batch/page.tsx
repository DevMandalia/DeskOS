import Link from "next/link";
import type { Metadata } from "next";

import { BatchGroups } from "@/components/batch-groups";
import { DemoDesk } from "@/components/demo-desk";
import { DeskFrame } from "@/components/desk-frame";
import { isStaticDemo } from "@/lib/demo-mode";
import { STATUS } from "@/lib/decide";
import { batchGroups, batchParkDate, todayYmd } from "@/lib/desk-contract";
import { deskTimezone } from "@/lib/env";
import { listOwnerRows } from "@/lib/owner-rows";
import { demoDecisions } from "@/lib/seed";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Batch" };

export default async function BatchPage() {
  if (isStaticDemo()) {
    return (
      <DeskFrame email="owner@acme.test" rows={demoDecisions()} scope={{ area: null, view: "waiting", includeDone: false }}>
        <DemoDesk page="home" />
      </DeskFrame>
    );
  }
  const user = await requireUser();
  const rows = await listOwnerRows();
  const groups = batchGroups(rows, STATUS.waiting);
  const today = todayYmd(new Date(), deskTimezone());
  return (
    <DeskFrame email={user.email} rows={rows} scope={{ area: null, view: "waiting", includeDone: false }}>
      <div className="desk">
        <header className="desk-head">
          <h1>Batch</h1>
          <p className="desk-sub">Low-stakes waiting only. Each row still gets a verdict.</p>
        </header>
        {groups.length === 0 ? (
          <p className="empty">
            No similar group. <Link href="/waiting">Waiting on you</Link>
          </p>
        ) : (
          <BatchGroups groups={groups} parkDate={batchParkDate(today)} />
        )}
      </div>
    </DeskFrame>
  );
}
