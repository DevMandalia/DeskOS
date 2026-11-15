import { DemoDesk } from "@/components/demo-desk";
import { DeskFrame } from "@/components/desk-frame";
import { DEMO_DECISION_IDS, demoDecisions } from "@/lib/seed";

export function generateStaticParams() {
  return Object.values(DEMO_DECISION_IDS).map((id) => ({ id }));
}

export default async function DecisionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <DeskFrame
      email="owner@acme.test"
      rows={demoDecisions()}
      scope={{ area: null, view: "waiting", includeDone: false }}
      currentId={id}
    >
      <DemoDesk page="decision" decisionId={id} />
    </DeskFrame>
  );
}
