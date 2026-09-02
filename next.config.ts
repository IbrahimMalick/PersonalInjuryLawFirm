import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  // "standalone" is for the Docker/self-host image (Dockerfile copies
  // .next/standalone). Vercel runs its own output tracing and breaks on a
  // standalone build (missing *.nft.json in onBuildComplete), so leave it
  // unset there — Vercel sets VERCEL=1 during the build.
  output: process.env.VERCEL ? undefined : "standalone",
};

export default nextConfig;
