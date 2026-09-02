# Deploying Nightshift

**One deployment serves every firm.** Attorneys self-serve at `/signup`;
every row is scoped by firm id and every query enforces it (two-firm
isolation is covered by the E2E checks). Your team's accounts, allowlisted in
`OPERATOR_EMAILS`, get the `/operator` console for onboarding and phone-number
provisioning. Requires a **long-running Node process** (the background worker
runs inside the web process), so any Docker host works; serverless does not.

Storage is a single SQLite file behind Drizzle — right for one app server and
early-stage firm counts, with Litestream for continuous replication. Swap to
Postgres (Drizzle dialect change + regenerated migrations) when you need a
second app server or managed point-in-time recovery.

## Local / development

```bash
npm install
cp .env.example .env.local     # add ANTHROPIC_API_KEY
npm run dev                    # http://localhost:3000 → /signup
```

Run the sales demo instead with `NIGHTSHIFT_MODE=demo npm run dev`.

## Docker (any VPS)

```bash
cp .env.example .env.local     # fill in keys + PUBLIC_BASE_URL
docker compose up -d --build
```

Put a TLS proxy (Caddy/Traefik/nginx) in front and set `PUBLIC_BASE_URL` to
the public https URL — Twilio signature verification depends on it.

## Fly.io

```bash
fly launch --no-deploy --name nightshift
fly volumes create nightshift_data --size 3
# in fly.toml: [mounts] source="nightshift_data" destination="/data"
# and: [env] PUBLIC_BASE_URL="https://your-domain.com"
fly secrets set ANTHROPIC_API_KEY=... OPERATOR_EMAILS=... TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=...
fly deploy
fly scale count 1   # REQUIRED: single SQLite writer + in-process worker
```

## Platform setup (you, once)

1. Deploy, then sign up your own team's accounts at `/signup` (any firm name —
   e.g. "Nightshift HQ") using the emails listed in `OPERATOR_EMAILS`.
2. Open `/operator` — every firm that signs up appears here with what's left
   to get them live.
3. Create the platform Twilio account and SendGrid account once; per-firm
   numbers are provisioned as firms onboard.

## Firm onboarding (per firm — self-serve + hand-holding)

A firm signs up at `/signup` and immediately has a working intake form at
`/intake/<their-slug>` — that's the "start working in two minutes" path. The
inbox shows them a checklist for the rest; on the onboarding call you do
together:

1. **Conflict list** — load current clients + adverse parties in their Settings.
2. **Deadline table** — an attorney at the firm reviews `lib/sol-table.ts`
   against current law and clicks the acknowledgment (countdowns stay hidden
   from their reviewers until then).
3. **Phone number** — buy a number in the platform Twilio account, point its
   webhooks (below), then paste the number into their row in `/operator`.
   Inbound routes to the firm by the number dialed; their approved replies
   send from it. The firm forwards their office line to it after hours.
4. **Email** — configure SendGrid Inbound Parse for their intake address to
   `{PUBLIC_BASE_URL}/api/inbound/email?token=<their per-firm token>` (shown
   in `/operator` and their Settings).
5. **Team** — they add reviewers in Settings.

## Twilio webhooks (same URLs for every number)

- Messaging → `POST {PUBLIC_BASE_URL}/api/inbound/twilio/sms`
- Voice → `POST {PUBLIC_BASE_URL}/api/inbound/twilio/voice`

WhatsApp rides the same Twilio account once Meta business verification
completes (weeks of lead time — start early).

## Backups

The database is one file. Nightly cron on the host:

```bash
docker compose exec nightshift sh -c \
  'node -e "require(\"@libsql/client\").createClient({url:\"file:/data/nightshift.db\"}).execute(\"VACUUM INTO /data/backup-$(date +%F).db\")"'
```

…then ship `/data/backup-*.db` off the box (rclone/S3). For continuous
replication, [Litestream](https://litestream.io) pointed at
`/data/nightshift.db` is the standard answer.

## Go-live checklist

- [ ] `PUBLIC_BASE_URL` set, TLS terminated in front
- [ ] `ANTHROPIC_API_KEY` set (send one test lead through `/intake`, watch it triage)
- [ ] `OPERATOR_EMAILS` set; `/operator` reachable by your team only
- [ ] Signed up a test firm; verified another account cannot see its leads
- [ ] Conflict list loaded; a matching test lead fires the hold
- [ ] SOL table reviewed by an attorney at the firm and acknowledged
- [ ] Twilio webhooks pointed; a real test call + text lands in the right firm's inbox
- [ ] Reply approved from the review screen arrives on a real phone, from the firm's number
- [ ] Backup cron in place and one restore actually tested
- [ ] Firm staff added as reviewers; passwords rotated from the temp ones
