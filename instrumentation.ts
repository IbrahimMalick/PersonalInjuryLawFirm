// Next.js server-start hook. Two jobs:
//   1. Refuse to boot in production if a required env var is missing — see
//      lib/env-check.ts for exactly which three, and why only those three.
//   2. Boot the background worker alongside the web process. Requires a
//      long-running Node deployment (Docker/VPS/Fly) — this is why
//      serverless needs the Postgres + external-worker variant instead.
export async function register(): Promise<void> {
  const { assertRequiredEnv } = await import("./lib/env-check");
  assertRequiredEnv();

  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NIGHTSHIFT_MODE !== "demo") {
    const { startWorker } = await import("./lib/worker");
    startWorker();
  }
}
