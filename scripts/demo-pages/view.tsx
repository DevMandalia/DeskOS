import { notFound } from "next/navigation";

import { DemoDesk } from "@/components/demo-desk";
import { DeskFrame } from "@/components/desk-frame";
import { VIEW_SLUG, viewFromSlug } from "@/lib/nav";
import { demoDecisions } from "@/lib/seed";

export function generateStaticParams() {
  return Object.values(VIEW_SLUG).map((view) => ({ view }));
}

export default async function ViewPage({ params }: { params: Promise<{ view: string }> }) {
  const slug = (await params).view;
  const view = viewFromSlug(slug);
  if (!view) notFound();
  return (
    <DeskFrame
      email="owner@acme.test"
      rows={demoDecisions()}
      scope={{ area: null, view, includeDone: false }}
    >
      <DemoDesk page="view" viewSlug={slug} />
    </DeskFrame>
  );
}
