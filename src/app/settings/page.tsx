import { DemoDesk } from "@/components/demo-desk";
import { DeskFrame } from "@/components/desk-frame";
import { SettingsAgents } from "@/components/settings-agents";
import { loadAgentStore } from "@/adapters/load";
import { publicAgent } from "@/lib/agent-ref";
import { isStaticDemo } from "@/lib/demo-mode";
import { listRows } from "@/lib/rows";
import { demoDecisions } from "@/lib/seed";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  if (isStaticDemo()) {
    return (
      <DeskFrame
        email="owner@acme.test"
        rows={demoDecisions()}
        scope={{ area: null, view: "waiting", includeDone: false }}
      >
        <DemoDesk page="settings" />
      </DeskFrame>
    );
  }

  const user = await requireUser();
  const [rows, agents] = await Promise.all([listRows(), (await loadAgentStore()).list()]);
  return (
    <DeskFrame email={user.email} rows={rows} scope={{ area: null, view: "waiting", includeDone: false }}>
      <div className="desk">
        <header className="desk-head">
          <h1>Settings</h1>
          <p className="desk-sub">API keys for agents. Each key is shown once. Stored hashed.</p>
        </header>
        <SettingsAgents initial={agents.map(publicAgent)} />
      </div>
    </DeskFrame>
  );
}
