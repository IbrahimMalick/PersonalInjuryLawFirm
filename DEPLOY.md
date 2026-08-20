# Deploying Nightshift

One instance = one firm. Each deployment carries its own SQLite database on a
persistent volume — total data isolation between firms by construction.
Requires a **long-running Node process** (the background worker runs inside
the web process), so any Docker host works; serverless does not.

## Local / development

```bash
npm install
cp .env.example .env.local     # add ANTHROPIC_API_KEY
npm run dev                    # http://localhost:3000 → first-run /setup
```

Run the sales demo instead with `NIGHTSHIFT_MODE=demo npm run dev`.

## Docker (any VPS)

```bash
cp .env.example .env.local     # fill in keys + PUBLIC_BASE_URL
docker compose up -d --build
```

Put a TLS proxy (Caddy/Traefik/nginx) in front and set `PUBLIC_BASE_URL` to
the public https URL — Twilio signature verification depends on it.

## Fly.io (per-firm apps)

```bash
fly launch --no-deploy --name nightshift-<firm>   # generates fly.toml from the Dockerfile
fly volumes create nightshift_data --size 1
# in fly.toml: [mounts] source="nightshift_data" destination="/data"
# and: [env] PUBLIC_BASE_URL="https://nightshift-<firm>.fly.dev"
fly secrets set ANTHROPIC_API_KEY=... TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_PHONE_NUMBER=...
fly deploy
```

Keep exactly **one machine** per app (single SQLite writer + in-process
worker): `fly scale count 1`.

## First run

Open the instance → `/setup` creates the firm identity and the first admin.
Then in **Settings**:

1. Fill in the letterhead details and timezone.
2. Load the firm's **conflict list** (current clients + adverse parties).
3. Review `lib/sol-table.ts` against current law for the firm's states and
   click the **deadline-table acknowledgment** — countdowns stay hidden from
   reviewers until an attorney does.
4. Wire channels (below). Until then, approvals run visibly **simulated**.

## Channels

**Web form** — live immediately at `PUBLIC_BASE_URL/intake`. Link the firm
site's "Contact us" button to it.

**Twilio (SMS + voicemail + WhatsApp)** — buy a number, set env vars
(`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`), then in
the Twilio console point the number at:

- Messaging webhook → `POST {PUBLIC_BASE_URL}/api/inbound/twilio/sms`
- Voice webhook → `POST {PUBLIC_BASE_URL}/api/inbound/twilio/voice`

WhatsApp rides the same Twilio account once Meta business verification
completes (weeks of lead time — start early).

**Email** — set `SENDGRID_API_KEY`, `EMAIL_FROM_ADDRESS`, and a long random
`EMAIL_INBOUND_TOKEN`; configure SendGrid Inbound Parse for the firm's intake
address to POST to
`{PUBLIC_BASE_URL}/api/inbound/email?token=<EMAIL_INBOUND_TOKEN>`.

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
- [ ] Conflict list loaded; add a fake test entry, send a matching lead, watch the hold fire, then remove it
- [ ] SOL table reviewed by an attorney and acknowledged in Settings
- [ ] Twilio webhooks pointed and a real test call + text made end to end
- [ ] Reply approved from the review screen arrives on a real phone
- [ ] Backup cron in place and one restore actually tested
- [ ] Firm staff added as reviewers; passwords rotated from the temp ones
