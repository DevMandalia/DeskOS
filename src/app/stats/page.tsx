import Link from "next/link";
import type { Metadata } from "next";

import { DemoDesk } from "@/components/demo-desk";
import { DeskFrame } from "@/components/desk-frame";
import { isStaticDemo } from "@/lib/demo-mode";
import { STATUS } from "@/lib/decide";
import { agentStatsFromRows, parseAutoApprove } from "@/lib/desk-contract";
import { listOwnerRows } from "@/lib/owner-rows";
import { demoDecisions } from "@/lib/seed";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Stats" };

export default async function StatsPage() {
  if (isStaticDemo()) {
    return (
      <DeskFrame email="owner@acme.test" rows={demoDecisions()} scope={{ area: null, view: "waiting", includeDone: false }}>
        <DemoDesk page="home" />
      </DeskFrame>
    );
  }
  const user = await requireUser();
  const rows = await listOwnerRows();
  const agents = agentStatsFromRows(rows, STATUS.waiting);
  const auto = parseAutoApprove();
  return (
    <DeskFrame email={user.email} rows={rows} scope={{ area: null, view: "waiting", includeDone: false }}>
      <div className="desk">
        <header className="desk-head">
          <h1>Agent scorecard</h1>
          <p className="desk-sub">
            Unscored counts. Auto-approve is {auto}. Learned classes do nothing while the master switch is off.
          </p>
        </header>
        {agents.length === 0 ? (
          <p className="empty">No agents have raised yet.</p>
        ) : (
          <table className="stats-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Raised</th>
                <th>Waiting</th>
                <th>Approved</th>
                <th>Declined</th>
                <th>Parked</th>
                <th>Approval</th>
                <th>Discuss</th>
                <th>Timeout</th>
                <th>Split</th>
                <th>Median hours</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{a.raised}</td>
                  <td>{a.open_waiting}</td>
                  <td>{a.approved}</td>
                  <td>{a.declined}</td>
                  <td>{a.parked}</td>
                  <td>{a.approval_rate == null ? "—" : `${Math.round(a.approval_rate * 100)}%`}</td>
                  <td>{Math.round(a.discuss_rate * 100)}%</td>
                  <td>{Math.round(a.timeout_rate * 100)}%</td>
                  <td>{Math.round(a.split_rate * 100)}%</td>
                  <td>{a.median_time_to_verdict_hours == null ? "—" : a.median_time_to_verdict_hours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="home-more">
          <Link href="/settings">API keys</Link>
        </p>
      </div>
    </DeskFrame>
  );
}
