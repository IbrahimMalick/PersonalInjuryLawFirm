// Boot-time check for the env vars that have NO legitimate "unset" mode in
// production. Deliberately a short list — most integrations here (Stripe,
// Twilio, GHL/SendGrid, OPERATOR_EMAILS) are BY DESIGN optional, so the
// platform runs for dev and early pilots without an account for any of them
// (see lib/billing.ts's comment on "free mode"). The three below are
// different: there is no working mode of the product with one of them unset,
// only a silent one.
//
//   DATABASE_URL     — unset, the app falls back to an embedded local
//                       Postgres on the server's own ephemeral filesystem.
//                       That's the right default for `npm run dev`; in a
//                       real deployment it means every cold start starts
//                       from an empty database with no warning.
//   CRON_SECRET       — unset, Vercel never attaches the auth header the
//                       cron sweeper checks, so it 401s forever. No retries,
//                       no stuck-job recovery, no 30-minute sign-now
//                       escalation, no weekly digest — and the only trace is
//                       401s in a Vercel tab nobody watches.
//   PUBLIC_BASE_URL   — unset, every link this app ever emails (email
//                       verification, password reset, the high-priority
//                       alert, the weekly digest) is built from a fallback
//                       that doesn't resolve to the real site.
//
// This is the fix for Pre-Launch Audit blocker 5 ("unconfigured integrations
// report success"): refusing to boot turns a silent failure into a failed
// deploy, which is the one failure mode Vercel actually surfaces.

export const REQUIRED_IN_PRODUCTION = ["DATABASE_URL", "CRON_SECRET", "PUBLIC_BASE_URL"] as const;

export class MissingEnvError extends Error {
  constructor(public readonly missing: string[]) {
    super(
      `Refusing to start: missing required env var(s) in production: ${missing.join(", ")}. ` +
        `Each has a silent failure mode if left unset — set them in Vercel → Settings → ` +
        `Environment Variables, Production scope, then redeploy.`
    );
    this.name = "MissingEnvError";
  }
}

/**
 * Throws MissingEnvError if any required var is absent. A no-op outside
 * production, and outside production demo mode (NIGHTSHIFT_MODE=demo), which
 * intentionally runs without most of this (lib/mode.ts).
 */
export function assertRequiredEnv(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== "production" || env.NIGHTSHIFT_MODE === "demo") return;
  const missing = REQUIRED_IN_PRODUCTION.filter((k) => !env[k]);
  if (missing.length > 0) throw new MissingEnvError(missing);
}
