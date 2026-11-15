import { DemoDesk } from "@/components/demo-desk";
import { DeskFrame } from "@/components/desk-frame";
import { demoDecisions } from "@/lib/seed";

export default function HomePage() {
  return (
    <DeskFrame
      email="owner@acme.test"
      rows={demoDecisions()}
      scope={{ area: null, view: "waiting", includeDone: false }}
      home
    >
      <DemoDesk page="home" />
    </DeskFrame>
  );
}
