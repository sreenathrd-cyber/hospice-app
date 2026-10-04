import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PHI never belongs in the client bundle — the dashboard reads everything
  // through authenticated server-side fetches to apps/api (see lib/api.ts).
  poweredByHeader: false,
};

export default nextConfig;
