import type { NextConfig } from "next";

/**
 * Deployed apart (Vercel + Render), the browser talks only to this site and
 * Next forwards /api/v1 and /uploads to the API. The session cookies then stay
 * first-party, which proxy.ts needs and browsers that block third-party
 * cookies allow (docs/DECISIONS.md D-068). Locally it stays unset.
 */
const apiProxyTarget = process.env.API_PROXY_TARGET?.replace(/\/$/, "");

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
    // Retries navigations when the connection returns and powers useOffline() (OfflineBanner).
    useOffline: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  // Docker on Windows: file events do not cross the bind mount, so Turbopack
  // must poll. Only when the compose file asks for it (WATCHPACK_POLLING=true);
  // see docs/DECISIONS.md D-036.
  ...(process.env.WATCHPACK_POLLING === "true" ? { watchOptions: { pollIntervalMs: 1000 } } : {}),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  async rewrites() {
    if (!apiProxyTarget) return [];
    return [
      { source: "/api/v1/:path*", destination: `${apiProxyTarget}/api/v1/:path*` },
      { source: "/uploads/:path*", destination: `${apiProxyTarget}/uploads/:path*` },
    ];
  },
  // Prototype routes were renamed to English in phase 2; keep old links working.
  async redirects() {
    return [
      { source: "/veredito", destination: "/verdict", permanent: true },
      { source: "/nota", destination: "/receipts/import", permanent: true },
      { source: "/lojista", destination: "/merchant", permanent: true },
      { source: "/transparencia", destination: "/how-it-works", permanent: true },
    ];
  },
};

export default nextConfig;
