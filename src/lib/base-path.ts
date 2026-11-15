/**
 * Optional sub-path (e.g. "/desk") when the app is mounted behind a reverse
 * proxy. Empty by default — the OSS kit serves at the site root.
 */
function readBasePath(): string {
  const raw = (process.env.NEXT_PUBLIC_BASE_PATH ?? process.env.BASE_PATH ?? "").trim();
  if (!raw || raw === "/") return "";
  return raw.startsWith("/") ? raw.replace(/\/$/, "") : `/${raw.replace(/\/$/, "")}`;
}

export const BASE_PATH = readBasePath();

/** Prefix an app path ("/api/decide") with the base path. */
export function withBasePath(path: string): string {
  if (!BASE_PATH) {
    if (!path.startsWith("/")) return `/${path}`;
    return path;
  }
  if (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`)) return path;
  if (!path.startsWith("/")) path = `/${path}`;
  return path === "/" ? BASE_PATH : `${BASE_PATH}${path}`;
}

/** Drop the base path from a pathname, whether or not it was already stripped. */
export function stripBasePath(pathname: string): string {
  if (!BASE_PATH) return pathname || "/";
  if (pathname === BASE_PATH) return "/";
  if (pathname.startsWith(`${BASE_PATH}/`)) return pathname.slice(BASE_PATH.length);
  return pathname;
}

/**
 * Only same-site, base-path-relative targets are allowed after sign-in.
 * Anything else falls back to home.
 */
export function safeCallbackPath(value: string | null | undefined): string {
  const home = BASE_PATH || "/";
  if (!value || !value.startsWith("/") || value.startsWith("//")) return home;
  return withBasePath(value);
}

/** Public origin taken from AUTH_URL, if set. */
export function publicOrigin(fallback: string): string {
  const url = process.env.AUTH_URL;
  if (!url) return fallback;
  try {
    return new URL(url).origin;
  } catch {
    return fallback;
  }
}
