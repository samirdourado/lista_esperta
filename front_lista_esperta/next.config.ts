import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
    // Retries navigations when the connection returns and powers useOffline() (OfflineBanner).
    useOffline: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
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
