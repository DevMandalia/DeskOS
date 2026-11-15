import type { NextConfig } from "next";

const isDemo = process.env.NEXT_PUBLIC_DESK_DEMO === "1" || process.env.DESK_DEMO === "1";
const rawBase = (process.env.NEXT_PUBLIC_BASE_PATH ?? process.env.BASE_PATH ?? "").trim();
const basePath = !rawBase || rawBase === "/" ? "" : rawBase.startsWith("/") ? rawBase.replace(/\/$/, "") : `/${rawBase.replace(/\/$/, "")}`;

const nextConfig: NextConfig = {
  basePath,
  poweredByHeader: false,
  trailingSlash: isDemo,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

if (isDemo) {
  nextConfig.output = "export";
  nextConfig.images = { unoptimized: true };
} else {
  nextConfig.experimental = { authInterrupts: true };
  nextConfig.headers = async () => [
    {
      source: "/:path*",
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
    },
  ];
}

export default nextConfig;
