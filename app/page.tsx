import Link from "next/link";
import { redirect } from "next/navigation";
import { and, count, desc, eq, inArray, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { updateFirm } from "@/lib/firm";
import AppShell from "@/components/product/AppShell";
import { currentUser, requireFirmUser } from "@/lib/auth";
import Landing from "@/components/Landing";
import { getDb, tables } from "@/lib/db";
import { isDemo } from "@/lib/mode";
import { fmtDateTime, agoLabel } from "@/lib/format";
import { caseTypeLabelOf, contactOf, isTimeCritical, type AnyCaseFile } from "@/lib/casefile";
import { ROUTING_LABEL } from "@/lib/labels";
import { leadUrgency, type Urgency } from "@/lib/urgency";

export const dynamic = "force-dynamic";

const CHANNEL_GLYPH: Record<string, string> = {
  voicemail: "VM",
  sms: "SMS",
  whatsapp: "WA",
  webform: "WEB",
  email: "EM",
};

function urgencyRowClass(urgency: Urgency, needsEyes: boolean): string {
  if (urgency === "red") return "border-stamp/70 bg-stamp/5";
  if (urgency === "amber") return "border-meter/50 bg-meter/5";
  return needsEyes ? "border-ink-line" : "border-ink-line/50 opacity-80";
}

function StatusChip({
  status,
  caseFile,
  replied,
}: {
  status: string;
  caseFile: AnyCaseFile | null;
  replied: boolean;
}) {
  if (status === "needs_attention")
    return <span className="field-label text-stamp">Needs attention</span>;
  if (status === "received" || status === "processing")
    return <span className="field-label text-meter">Reading…</span>;
  if (status === "archived") return <span className="field-label text-dim">Archived</span>;
  if (caseFile?.conflictFlags?.length)
    return <span className="field-label text-stamp">CONFLICT — HELD</span>;
  if (replied) return <span className="field-label text-ok">Reply sent ✓</span>;
  if (isTimeCritical(caseFile))
    return (
      <span className="field-label text-stamp font-semibold">
        ⚠ TIME-CRITICAL · {ROUTING_LABEL[caseFile!.routing]}
      </span>
    );
  if (caseFile)
    return (
      <span
        className={`field-label ${caseFile.routing === "decline" ? "text-stamp" : "text-manila"}`}
      >
        {ROUTING_LABEL[caseFile.routing]} · awaiting review
      </span>
    );
  return <span className="field-label text-dim">Waiting</span>;
}

async function dismissOnboarding(): Promise<void> {
  "use server";
  const { user, firm } = await requireFirmUser("admin");
  await updateFirm(firm.id, { onboardingDismissedAt: new Date().toISOString() });
  await audit("settings.onboarding_dismissed", { firmId: firm.id, userId: user.id });
  revalidatePath("/");
}

async function OnboardingCard({
  firmId,
  slug,
  solAcknowledged,
  twilioNumber,
  isAdmin,
}: {
  firmId: number;
  slug: string;
  solAcknowledged: boolean;
  twilioNumber: string | null;
  isAdmin: boolean;
}) {
  const db = await getDb();
  const [partyCount] = await db
    .select({ n: count() })
    .from(tables.adverseParties)
    .where(and(eq(tables.adverseParties.firmId, firmId), eq(tables.adverseParties.active, true)));
  const [teamCount] = await db
    .select({ n: count() })
    .from(tables.users)
    .where(eq(tables.users.firmId, firmId));
  const base = process.env.PUBLIC_BASE_URL ?? "";

  const steps: { done: boolean; label: React.ReactNode }[] = [
    {
      done: true,
      label: (
        <>
          Your intake form is live —{" "}
          <span className="font-mono text-manila break-all">{base || ""}/intake/{slug}</span>.
          Link it from your website today.
        </>
      ),
    },
    {
      done: (partyCount?.n ?? 0) > 0,
      label: (
        <>
          Load your <Link href="/settings/conflicts" className="text-manila underline underline-offset-4">conflict list</Link> —
          current clients and adverse parties, so the engine can hold anything that matches.
        </>
      ),
    },
    {
      done: solAcknowledged,
      label: (
        <>
          Have an attorney review and acknowledge the{" "}
          <Link href="/settings" className="text-manila underline underline-offset-4">deadline table</Link>{" "}
          — countdowns stay hidden until then.
        </>
      ),
    },
    {
      done: Boolean(twilioNumber),
      label: (
        <>
          Get your intake phone number — we provision it with you on the setup call, then you
          forward your office line after hours.
        </>
      ),
    },
    {
      done: (teamCount?.n ?? 0) > 1,
      label: (
        <>
          Add your team as reviewers under{" "}
          <Link href="/settings" className="text-manila underline underline-offset-4">Settings</Link>.
        </>
      ),
    },
  ];
  const remaining = steps.filter((s) => !s.done).length;

  return (
    <div className="rounded-sm border-2 border-manila/60 bg-ink-raised px-5 py-4 mb-4">
      <div className="flex items-center justify-between pb-2">
        <span className="font-display font-bold uppercase tracking-wide text-lg text-paper">
          Getting set up{remaining > 0 ? ` — ${remaining} step${remaining === 1 ? "" : "s"} left` : " — done!"}
        </span>
        {isAdmin && (
          <form action={dismissOnboarding}>
            <button className="field-label text-dim hover:text-inktext">Dismiss</button>
          </form>
        )}
      </div>
      <ul className="space-y-1.5 text-[15px]">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-2.5">
            <span className={step.done ? "text-ok" : "text-manila"}>{step.done ? "☑" : "☐"}</span>
            <span className={step.done ? "text-dim" : "text-inktext"}>{step.label}</span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-dim mt-3 border-t border-ink-line pt-2.5">
        Want hands held? That&apos;s what we&apos;re here for — book your onboarding call and
        we&apos;ll do the phone number, conflict list, and deadline review together.
      </p>
    </div>
  );
}

export default async function Inbox({
  searchParams,
}: {
  searchParams: Promise<{ area?: string }>;
}) {
  if (isDemo()) redirect("/demo");
  if (!(await currentUser())) {
    // The public landing page speaks to one practice area at a time
    // (?area=immigration, ?area=criminal).
    const { area } = await searchParams;
    return (
      <Landing
        area={
          area === "immigration"
            ? "immigration"
            : area === "criminal"
              ? "criminal_defense"
              : "personal_injury"
        }
      />
    );
  }
  const { user, firm } = await requireFirmUser();
  const db = await getDb();

  const leads = await db
    .select()
    .from(tables.leads)
    .where(
      and(eq(tables.leads.firmId, firm.id), notInArray(tables.leads.status, ["archived"]))
    )
    .orderBy(desc(tables.leads.receivedAt))
    .limit(200);

  const repliedRows = leads.length
    ? await db
        .select({ leadId: tables.messages.leadId })
        .from(tables.messages)
        .where(
          inArray(
            tables.messages.leadId,
            leads.map((l) => l.id)
          )
        )
    : [];
  const replied = new Set(repliedRows.map((r) => r.leadId));

  const leadsWithMeta = leads.map((lead) => {
    const cf = (lead.caseFile as unknown as AnyCaseFile | null) ?? null;
    const needsEyes =
      lead.status === "needs_attention" || (lead.status === "triaged" && !replied.has(lead.id));
    const urgency = leadUrgency({
      needsEyes,
      receivedAt: lead.receivedAt,
      routing: cf?.routing ?? null,
      timeCritical: isTimeCritical(cf),
    });
    return { lead, cf, needsEyes, urgency, timeCritical: isTimeCritical(cf) };
  });

  const counts = {
    waiting: leads.filter(
      (l) => l.status === "triaged" && !replied.has(l.id)
    ).length,
    attention: leads.filter((l) => l.status === "needs_attention").length,
    reading: leads.filter((l) => l.status === "received" || l.status === "processing").length,
    overdue: leadsWithMeta.filter((l) => l.urgency === "red" && !l.timeCritical).length,
    timeCritical: leadsWithMeta.filter((l) => l.timeCritical && l.needsEyes).length,
  };

  return (
    <AppShell user={user} firm={firm}>
      <div className="px-6 pt-4 max-w-[1200px] mx-auto">
        {!firm.onboardingDismissedAt && (
          <OnboardingCard
            firmId={firm.id}
            slug={firm.slug}
            solAcknowledged={Boolean(firm.solAcknowledgedAt)}
            twilioNumber={firm.twilioNumber}
            isAdmin={user.role === "admin"}
          />
        )}
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-5 font-mono text-sm">
            <span className="text-manila">{counts.waiting} awaiting review</span>
            {counts.timeCritical > 0 && (
              <span className="text-stamp font-bold">⚠ {counts.timeCritical} time-critical</span>
            )}
            {counts.overdue > 0 && (
              <span className="text-stamp font-semibold">⏱ {counts.overdue} overdue</span>
            )}
            {counts.attention > 0 && (
              <span className="text-stamp">{counts.attention} need attention</span>
            )}
            {counts.reading > 0 && <span className="text-meter">{counts.reading} reading</span>}
          </div>
          <Link href="/archive" className="field-label text-dim hover:text-inktext">
            Archive ▸
          </Link>
        </div>

        {leads.length === 0 ? (
          <div className="rounded-sm border border-ink-line bg-ink-raised px-6 py-14 text-center">
            <div className="font-display uppercase tracking-widest text-dim text-xl">
              The desk is quiet
            </div>
            <p className="text-dim mt-2 text-[15px] max-w-md mx-auto">
              New inquiries land here the moment they arrive — from the intake form, the
              firm&apos;s phone line, or email. Wire channels up under Settings.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {leadsWithMeta.map(({ lead, cf, needsEyes, urgency, timeCritical }) => {
              return (
                <Link
                  key={lead.id}
                  href={`/lead/${lead.id}`}
                  className={`grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-4 rounded-sm border px-4 py-3 bg-ink-raised transition-colors hover:border-manila ${urgencyRowClass(urgency, needsEyes)}`}
                >
                  <span className="font-mono text-xs text-dim border border-ink-line rounded-sm text-center py-1">
                    {CHANNEL_GLYPH[lead.channel] ?? lead.channel}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-baseline gap-3">
                      <span className="font-display font-semibold text-lg text-paper uppercase tracking-wide truncate">
                        {(cf ? contactOf(cf).name : null) ?? lead.displayName ?? lead.fromAddress}
                      </span>
                      {timeCritical && (
                        <span className="shrink-0 rounded-sm bg-stamp px-2 py-0.5 font-display text-sm font-bold uppercase tracking-wider text-paper">
                          ⚠ Time-critical
                        </span>
                      )}
                      {cf && (
                        <span className="font-mono text-sm text-dim shrink-0">
                          {caseTypeLabelOf(cf)}
                          {" · "}priority {cf.priorityScore}
                        </span>
                      )}
                    </span>
                    <span className="block text-[14px] text-dim truncate mt-0.5">
                      {lead.raw.replace(/\s+/g, " ").slice(0, 140)}
                    </span>
                  </span>
                  <span className="text-right shrink-0">
                    <StatusChip
                      status={lead.status}
                      caseFile={cf}
                      replied={replied.has(lead.id)}
                    />
                    <span
                      className={`block font-mono text-xs mt-1 ${
                        urgency === "red"
                          ? "text-stamp font-semibold"
                          : urgency === "amber"
                            ? "text-meter"
                            : "text-dim"
                      }`}
                    >
                      {urgency !== "none" && "⏱ "}
                      {fmtDateTime(lead.receivedAt, firm.timezone)} · {agoLabel(lead.receivedAt)}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
