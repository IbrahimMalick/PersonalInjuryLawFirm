// Next.js server-start hook: boots the background worker alongside the web
// process. Requires a long-running Node deployment (Docker/VPS/Fly) — this is
// why serverless needs the Postgres + external-worker variant instead.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NIGHTSHIFT_MODE !== "demo") {
    const { startWorker } = await import("./lib/worker");
    startWorker();
  }
}
