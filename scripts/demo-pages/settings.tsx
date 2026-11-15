import { DemoDesk } from "@/components/demo-desk";
import { DeskFrame } from "@/components/desk-frame";
import { demoDecisions } from "@/lib/seed";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
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
