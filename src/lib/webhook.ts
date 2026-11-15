/**
 * Best-effort JSON webhook (NOTIFY_WEBHOOK_URL).
 *
 * Auth header: NOTIFY_WEBHOOK_AUTH is sent verbatim as `Authorization`.
 * NOTIFY_WEBHOOK_TOKEN alone still sends `Authorization: Bearer <token>`.
 * Neither value, nor the URL, is ever logged.
 */

type Env = Record<string, string | undefined>;

export const WEBHOOK_TIMEOUT_MS = 5000;

export function webhookUrl(env: Env = process.env): string | null {
  const url = (env.NOTIFY_WEBHOOK_URL ?? "").trim();
  return /^https?:\/\//.test(url) ? url : null;
}

export function webhookHeaders(env: Env = process.env): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const auth = (env.NOTIFY_WEBHOOK_AUTH ?? "").trim();
  const token = (env.NOTIFY_WEBHOOK_TOKEN ?? "").trim();
  if (auth) headers.Authorization = auth;
  else if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export type WebhookResult =
  | { sent: false; reason: "unset" }
  | { sent: true; ok: boolean; status?: number; error?: string };

/** POST JSON; never throws. Times out after ~5 s. */
export async function postWebhook(
  label: string,
  payload: unknown,
  opts: { env?: Env; fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<WebhookResult> {
  const env = opts.env ?? process.env;
  const url = webhookUrl(env);
  if (!url) return { sent: false, reason: "unset" };
  const doFetch = opts.fetchImpl ?? fetch;
  try {
    const res = await doFetch(url, {
      method: "POST",
      headers: webhookHeaders(env),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(opts.timeoutMs ?? WEBHOOK_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) console.warn(`webhook ${label} failed: HTTP ${res.status}`);
    return { sent: true, ok: res.ok, status: res.status };
  } catch (err) {
    const name = err instanceof Error ? err.name : "error";
    console.warn(`webhook ${label} failed: ${name}`);
    return { sent: true, ok: false, error: name };
  }
}
