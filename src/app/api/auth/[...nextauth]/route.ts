import { NextRequest } from "next/server";

import { handlers } from "@/auth";
import { BASE_PATH } from "@/lib/base-path";

/**
 * Next.js strips its basePath from route-handler URLs, but Auth.js parses the
 * action against its own basePath (/desk/api/auth). Put the prefix back.
 */
function withBase(req: NextRequest): NextRequest {
  const url = new URL(req.url);
  if (url.pathname.startsWith(`${BASE_PATH}/`)) return req;
  url.pathname = `${BASE_PATH}${url.pathname}`;
  return new NextRequest(url, req);
}

export function GET(req: NextRequest) {
  return handlers.GET(withBase(req));
}

export function POST(req: NextRequest) {
  return handlers.POST(withBase(req));
}
