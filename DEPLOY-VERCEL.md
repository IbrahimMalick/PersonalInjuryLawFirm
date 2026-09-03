# Deploying Nightshift to Vercel — step-by-step

This guide takes you from zero to a live, multi-tenant Nightshift deployment on
Vercel with a real Postgres database, working sign-up emails, Stripe billing,
and (optionally) phone/SMS intake. Follow it top to bottom; each step tells you
exactly what to click and what value to copy where.

**What you need before starting**

- A GitHub account with access to this repository
- A Vercel account (vercel.com — sign up with that GitHub account; the **Pro
  plan is required** for the every-minute cron job, see step 7)
- A Neon account (neon.tech, free tier is fine to start) for Postgres
- An Anthropic API key (console.anthropic.com)
- A SendGrid account (sendgrid.com) for email
- A Stripe account (stripe.com) for billing
- Optional, can be added later: a Twilio account for phone/SMS/WhatsApp

Keep a scratch note open — you'll collect about ten secret values along the
way and paste them all into Vercel in step 5.

---

## Step 1 — Create the database (Neon)

1. Go to **neon.tech** → sign up / log in → **New Project**.
2. Name: `nightshift` · Region: pick the same region you'll deploy Vercel to
   (e.g. `US East (N. Virginia)`), Postgres version: default.
3. On the project dashboard, click **Connect** and copy the **connection
   string** — it looks like
   `postgres://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`.
4. Save it in your scratch note as `DATABASE_URL`.

That's the whole database setup. Nightshift runs its own migrations
automatically the first time it boots — you do not need to create tables.

> Vercel Postgres / Supabase / RDS also work; anything that yields a standard
> `postgres://` URL. Neon is the path of least resistance.

## Step 2 — Generate the app's own secrets

You need one random string for the cron job. In any terminal:

```bash
openssl rand -hex 32
```

(or use a password generator — 40+ random characters). Save it as
`CRON_SECRET`.

## Step 3 — SendGrid (verification, reset, and outbound email)

1. Sign up at **sendgrid.com** → Settings → **API Keys** → **Create API Key**
   → name `nightshift`, permission **Full Access** → copy the key
   (`SG.xxxx...`). Save as `SENDGRID_API_KEY`. It is shown only once.
2. Settings → **Sender Authentication** → **Verify a Single Sender** (fastest)
   or **Authenticate Your Domain** (better deliverability, do it before real
   launch). The email address you verify here is what you'll set as
   `EMAIL_FROM_ADDRESS` (e.g. `intake@yourdomain.com`).
3. Save `EMAIL_FROM_ADDRESS` and a display name (`EMAIL_FROM_NAME`, e.g.
   `Nightshift Intake`) in your note.

Without SendGrid configured, the app still runs — verification and reset
links are printed to the server logs instead of emailed, and outbound replies
show as "simulated." That's fine for a staging deploy, not for launch.

## Step 4 — Stripe (billing)

Do this in **Test mode** first (toggle top-right in the Stripe dashboard);
repeat in Live mode when you're ready to charge real cards.

1. **Create the product**: Dashboard → Product catalog → **Add product**.
   Name: `Nightshift`, add a **recurring monthly price** (e.g. $499/month).
   After saving, open the price and copy its ID (`price_...`). Save as
   `STRIPE_PRICE_ID`.
2. **Get the API key**: Developers → API keys → copy the **Secret key**
   (`sk_test_...` in test mode, `sk_live_...` in live). Save as
   `STRIPE_SECRET_KEY`.
3. **Webhook — do this AFTER step 6** (you need the deployed URL):
   Developers → Webhooks → **Add endpoint** →
   Endpoint URL: `https://YOUR-DOMAIN/api/stripe/webhook` →
   select events: `checkout.session.completed`,
   `customer.subscription.updated`, `customer.subscription.deleted` →
   Add endpoint → copy the **Signing secret** (`whsec_...`). Save as
   `STRIPE_WEBHOOK_SECRET`. You'll add it to Vercel and redeploy (step 8).
4. Optional but recommended: Settings → **Billing → Customer portal** →
   click Save once to activate the default portal (the app's "Manage billing"
   button uses it).

How billing behaves: with Stripe configured, every new firm gets a 14-day
free trial; when it lapses without a subscription, outbound sending is
paused (their data stays visible) until they subscribe from Settings →
Billing. With Stripe env vars unset, everything is simply free.

## Step 5 — Import the project into Vercel

1. Go to **vercel.com/new** → Import the `PersonalInjuryLawFirm` GitHub
   repository. Framework preset: **Next.js** (auto-detected). Leave build
   settings untouched.
2. Before clicking Deploy, expand **Environment Variables** and add
   (Production environment):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the Neon connection string from step 1 |
   | `ANTHROPIC_API_KEY` | your `sk-ant-...` key |
   | `PUBLIC_BASE_URL` | `https://YOUR-PROJECT.vercel.app` for now — update to your real domain in step 9 |
   | `OPERATOR_EMAILS` | your team's emails, comma-separated (e.g. `asad@...,ibrahim@...`) — grants the /operator console after you sign up with those emails |
   | `CRON_SECRET` | the random string from step 2 |
   | `SENDGRID_API_KEY` | from step 3 |
   | `EMAIL_FROM_ADDRESS` | the verified sender from step 3 |
   | `EMAIL_FROM_NAME` | e.g. `Nightshift Intake` |
   | `STRIPE_SECRET_KEY` | from step 4 |
   | `STRIPE_PRICE_ID` | from step 4 |

   (`NIGHTSHIFT_MODE` defaults to `live` — don't set it. `STRIPE_WEBHOOK_SECRET`
   comes in step 8.)
3. Click **Deploy** and wait for the build to go green.

## Step 6 — First smoke test

1. Open `https://YOUR-PROJECT.vercel.app` — you should see the landing page.
2. Click **Start free**, sign up with one of the `OPERATOR_EMAILS` addresses.
3. You should land in the inbox with a "Verify your email" banner; the
   verification email should arrive via SendGrid. Click the link.
4. Visit `/operator` — you should see the operator console with your firm
   listed. (403/redirect means the email doesn't match `OPERATOR_EMAILS`.)
5. From the onboarding card, open your firm's public intake form
   (`/intake/your-firm-slug`) and submit a test message. Within ~a minute it
   should appear in the inbox as a triaged case with a draft reply.

## Step 7 — Turn on the cron sweeper

The repo ships `vercel.json` with a cron that calls `/api/jobs/run` every
minute; it retries stuck work and is the safety net behind instant
processing.

- **Vercel Pro is required** — the Hobby plan limits crons to once per day,
  which means a failed job could wait a day for its retry. On the project:
  Settings → **Cron Jobs** → confirm `/api/jobs/run` is listed and enabled.
- The cron authenticates with `CRON_SECRET` automatically (Vercel sends it as
  a Bearer token because the env var is named `CRON_SECRET`).
- To verify manually:
  `curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://YOUR-DOMAIN/api/jobs/run`
  → should return JSON, not 401.

## Step 8 — Finish the Stripe webhook

Now that the app has a URL:

1. Do step 4.3 (create the webhook endpoint pointing at
   `https://YOUR-DOMAIN/api/stripe/webhook`).
2. In Vercel: Settings → Environment Variables → add
   `STRIPE_WEBHOOK_SECRET` = the `whsec_...` value → **Redeploy** (Deployments
   → ⋯ on the latest → Redeploy) so the running app picks it up.
3. Test: log in as a firm, Settings → Billing → **Subscribe** → pay with
   Stripe's test card `4242 4242 4242 4242` (any future expiry, any CVC) →
   you should bounce back to the app and Billing should show **Active**.
   In Stripe → Developers → Webhooks, the endpoint should show recent
   `200` deliveries.

## Step 9 — Custom domain

1. Vercel project → Settings → **Domains** → add e.g. `app.yourdomain.com`
   and follow the DNS instructions.
2. Update the `PUBLIC_BASE_URL` env var to `https://app.yourdomain.com` and
   **redeploy**. This matters: email links, Stripe redirect URLs, and Twilio
   signature verification are all derived from it.
3. If you created the Stripe webhook against the `.vercel.app` URL, edit the
   endpoint in Stripe to the new domain (same signing secret).

## Step 10 — Optional: phone, SMS & WhatsApp (Twilio)

Skip this at first — everything else works without it, and phone channels
show as "simulated" until configured.

1. Twilio Console → copy **Account SID** and **Auth Token** → add to Vercel
   as `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` → redeploy.
2. Buy one phone number per firm (Phone Numbers → Buy a number, voice + SMS).
3. On each number, set the webhooks:
   - **A call comes in** → `https://YOUR-DOMAIN/api/inbound/twilio/voice` (HTTP POST)
   - **A message comes in** → `https://YOUR-DOMAIN/api/inbound/twilio/sms` (HTTP POST)
4. In the app's `/operator` console, assign that number to the firm. Inbound
   traffic routes to the right firm by the number dialed.
5. Inbound email per firm: SendGrid → Settings → **Inbound Parse** → add a
   host (e.g. `intake.yourdomain.com`, MX record per SendGrid's instructions)
   with destination URL
   `https://YOUR-DOMAIN/api/inbound/email?token=FIRM_TOKEN` — each firm's
   token is shown in `/operator`.

## Step 10½ — Optional: CRM integrations

Firms self-serve most of these in **Settings → Integrations** — no platform
work needed: Clio Grow (Lead Inbox token), HubSpot (private-app token),
Filevine (PAT), CallRail (paste the shown webhook URL into CallRail), and the
generic webhook for GoHighLevel/Zapier. Two providers are OAuth-only and need
platform developer apps before their Connect buttons work:

- **Lawmatics**: email support@lawmatics.com to enable Developer Settings,
  create an app with redirect URI
  `https://YOUR-DOMAIN/api/integrations/lawmatics/callback`, then set
  `LAWMATICS_CLIENT_ID` / `LAWMATICS_CLIENT_SECRET` in Vercel and redeploy.
- **MyCase**: register a developer app (mycaseapi.stoplight.io) with redirect
  URI `https://YOUR-DOMAIN/api/integrations/mycase/callback`, then set
  `MYCASE_CLIENT_ID` / `MYCASE_CLIENT_SECRET` and redeploy.

Until those env vars exist, the Lawmatics/MyCase cards honestly say
"via onboarding call" and every other integration works normally. Use each
card's **Send test lead** button to verify credentials end to end.

## Step 11 — Pre-launch checklist

- [ ] `/terms` and `/privacy` reviewed by counsel; replace every
      `[BRACKETED]` placeholder in `app/terms/page.tsx` and
      `app/privacy/page.tsx` (company name, state, support email, hosting
      and database providers).
- [ ] Stripe switched to **Live mode**: live `STRIPE_SECRET_KEY`, live
      `STRIPE_PRICE_ID`, a live-mode webhook endpoint and its
      `STRIPE_WEBHOOK_SECRET` in Vercel; redeploy.
- [ ] SendGrid domain authentication done (not just single sender).
- [ ] Sign up a throwaway second firm and confirm it cannot see the first
      firm's leads (tenant isolation spot check), then archive/ignore it.
- [ ] Each real firm's onboarding: conflict list loaded, deadline table
      acknowledged by their attorney (statutes stay hidden until then),
      intake form linked from their website.

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Build succeeds but pages 500 | `DATABASE_URL` wrong or Neon project suspended — check Vercel → Deployments → Functions logs |
| Verification emails never arrive | `SENDGRID_API_KEY` / sender not verified; links are also printed in function logs as a fallback |
| Email/Stripe links point to localhost or wrong host | `PUBLIC_BASE_URL` unset or stale — fix and redeploy |
| Leads stuck in "Processing" | Cron not running (step 7) or `CRON_SECRET` mismatch — test the curl in step 7 |
| Every lead lands in "Needs attention" | `ANTHROPIC_API_KEY` missing/invalid — this is the designed fallback, a person handles the raw message |
| Billing page says nothing about trials | Stripe env vars not set — billing is off, everything is free |
| Subscribe works but firm never shows Active | Webhook not delivering: wrong URL, missing events, or `STRIPE_WEBHOOK_SECRET` not set — check Stripe webhook delivery logs |
| Twilio calls/texts do nothing | Number webhooks not set (step 10.3), number not assigned in `/operator`, or `PUBLIC_BASE_URL` doesn't match the public host (signature check fails) |
