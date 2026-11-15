import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { publicOrigin, stripBasePath, withBasePath } from "@/lib/base-path";
import { isAllowedEmail, isAuthBypass } from "@/lib/env";

function withRobots(response: NextResponse): NextResponse {
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

function isPublicPath(pathname: string): boolean {
  if (pathname === "/signin" || pathname === "/forbidden") return true;
  if (pathname === "/robots.txt") return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname.startsWith("/api/v1")) return true;
  return false;
}

const authProxy = auth((req) => {
  const pathname = stripBasePath(req.nextUrl.pathname);
  const origin = publicOrigin(req.nextUrl.origin);

  if (isPublicPath(pathname) || isAuthBypass()) {
    return withRobots(NextResponse.next());
  }

  const email = req.auth?.user?.email ?? null;
  const isApi = pathname.startsWith("/api/");

  if (!email) {
    if (isApi) {
      return withRobots(NextResponse.json({ error: "unauthorized" }, { status: 401 }));
    }
    const signIn = new URL(withBasePath("/signin"), origin);
    signIn.searchParams.set("callbackUrl", `${withBasePath(pathname)}${req.nextUrl.search}`);
    return withRobots(NextResponse.redirect(signIn));
  }

  if (!isAllowedEmail(email)) {
    if (isApi) {
      return withRobots(NextResponse.json({ error: "forbidden" }, { status: 403 }));
    }
    return withRobots(NextResponse.redirect(new URL(withBasePath("/forbidden"), origin)));
  }

  return withRobots(NextResponse.next());
});

function isStaticAsset(pathname: string): boolean {
  if (pathname.startsWith("/_next/static/") || pathname.startsWith("/_next/image")) return true;
  if (pathname === "/favicon.ico") return true;
  return /\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/.test(pathname);
}

function canonicalRedirect(req: NextRequest): NextResponse | null {
  if (!process.env.VERCEL || !process.env.AUTH_URL) return null;
  let canonical: URL;
  try {
    canonical = new URL(process.env.AUTH_URL);
  } catch {
    return null;
  }
  const seenHost = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!seenHost || seenHost === canonical.host) return null;
  const target = new URL(
    `${withBasePath(stripBasePath(req.nextUrl.pathname))}${req.nextUrl.search}`,
    canonical.origin,
  );
  return withRobots(NextResponse.redirect(target, 301));
}

export function proxy(req: NextRequest, event: NextFetchEvent) {
  const redirect = canonicalRedirect(req);
  if (redirect) return redirect;
  if (isStaticAsset(stripBasePath(req.nextUrl.pathname))) return NextResponse.next();
  return authProxy(req, event as unknown as Parameters<typeof authProxy>[1]);
}

export const config = {
  matcher: ["/", "/:path*"],
};
