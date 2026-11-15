/** Static / sandbox demo. Set NEXT_PUBLIC_DESK_DEMO=1 (and DESK_DEMO=1) at build time. */
export function isStaticDemo(): boolean {
  return process.env.NEXT_PUBLIC_DESK_DEMO === "1" || process.env.DESK_DEMO === "1";
}

/** GitHub README fragment for enabling chat after self-hosting. */
export const DEMO_CHAT_README_HREF = "https://github.com/DevMandalia/DeskOS#optional-chat";

export function demoBanner(): string {
  return "Demo — fake Acme sample data. Nothing is sent anywhere.";
}

/** Agent API, chat, and webhooks are off in demo. */
export function demoApiBlocked(): Response | null {
  if (!isStaticDemo()) return null;
  return Response.json({ error: "disabled in demo" }, { status: 404 });
}
