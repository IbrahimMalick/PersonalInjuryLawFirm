import type { FamilyCaseFile } from "@/lib/family-schema";
import { FAMILY_CASE_STAGE_LABEL, OTHER_PARTY_RELATIONSHIP_LABEL } from "@/lib/labels";

// The family-law half of the lead review screen: the stated dates and the
// facts the sender gave. A server component — no state.
//
// There is no computed-deadline panel here the way PI, immigration, and
// criminal defense have one — lib/family-deadlines.ts explains why no rule
// table exists for this area. What's shown is exactly what the sender said
// they were told (a hearing date, a response-due date), labelled "stated by
// the sender," gated behind the same attorney acknowledgment as the other
// areas so staff never read it as pre-vetted.

const card = "rounded-sm border border-ink-line bg-ink-raised px-5 py-4";
const URGENT_DAYS = 7;

function yesNo(v: boolean | "unknown"): string {
  return v === "unknown" ? "unknown" : v ? "yes" : "no";
}

export default function FamilyCaseView({
  cf,
  deadlinesVisible,
}: {
  cf: FamilyCaseFile;
  deadlinesVisible: boolean;
}) {
  const soonest = cf.soonestDeadline;
  const soonestUrgent = soonest != null && soonest.daysRemaining <= URGENT_DAYS;
  const court = [cf.court.courtName, cf.court.jurisdiction].filter(Boolean).join(" · ");

  return (
    <div className="grid grid-cols-2 gap-3">
      <div
        className={`rounded-sm border px-5 py-4 ${
          deadlinesVisible && soonestUrgent ? "border-stamp bg-stamp/10" : "border-ink-line bg-ink-raised"
        }`}
      >
        <div className="field-label text-dim">Dates the sender was told</div>
        {!deadlinesVisible ? (
          <p className="text-dim text-[15px] mt-2 italic">
            Hidden until an attorney reviews and acknowledges how this practice handles dates, in
            Settings.
          </p>
        ) : cf.deadlines.length === 0 ? (
          <p className="text-dim text-[15px] mt-2 italic">
            Nothing stated yet — no hearing date or response-due date was given.
          </p>
        ) : (
          <ul className="mt-2 space-y-3">
            {cf.deadlines.map((d) => (
              <li key={d.trigger} className="border-t border-ink-line pt-2 first:border-t-0 first:pt-0">
                <div className="text-inktext text-[15px] font-semibold">{d.label}</div>
                <div
                  className={`font-mono font-semibold text-3xl tabular-nums leading-none mt-1 ${
                    d.daysRemaining <= URGENT_DAYS ? "text-stamp" : "text-inktext"
                  }`}
                >
                  {d.daysRemaining < 0
                    ? `${Math.abs(d.daysRemaining).toLocaleString()} days past`
                    : `${d.daysRemaining.toLocaleString()} days left`}
                </div>
                <div className="font-mono text-sm text-dim mt-1">on {d.deadlineISO}</div>
                <div className="text-sm text-dim mt-1">{d.basis}</div>
              </li>
            ))}
          </ul>
        )}
        <div className="field-label text-manila mt-3">
          Exactly as the sender was told — no rule table computes this (see Settings)
        </div>
      </div>

      <div className={card}>
        <div className="field-label text-dim">What the sender told us</div>
        <div className="font-display font-bold uppercase tracking-wide text-2xl mt-2 text-inktext">
          {FAMILY_CASE_STAGE_LABEL[cf.court.caseStage]}
        </div>
        <div className="mt-3 space-y-1 font-mono text-sm">
          {cf.otherParty.name && (
            <div>
              <span className="text-dim">Other party · </span>
              {cf.otherParty.name} ({OTHER_PARTY_RELATIONSHIP_LABEL[cf.otherParty.relationship]})
            </div>
          )}
          <div>
            <span className="text-dim">Children involved · </span>
            {yesNo(cf.childrenInvolved)}
          </div>
          <div>
            <span className="text-dim">Safety concern · </span>
            <span className={cf.safetyConcern === true ? "text-stamp font-semibold" : ""}>
              {yesNo(cf.safetyConcern)}
            </span>
          </div>
          <div>
            <span className="text-dim">Existing protective order · </span>
            {yesNo(cf.existingProtectiveOrder)}
          </div>
          <div>
            <span className="text-dim">Served with papers · </span>
            {yesNo(cf.servedWithPapers)}
          </div>
          <div>
            <span className="text-dim">Court · </span>
            {court || "not stated"}
          </div>
          {cf.court.caseNumber && (
            <div>
              <span className="text-dim">Case number · </span>
              {cf.court.caseNumber}
            </div>
          )}
          <div>
            <span className="text-dim">Already has a lawyer · </span>
            {yesNo(cf.priorRepresentation)}
          </div>
          <div>
            <span className="text-dim">Confidence · </span>
            {((cf.confidence ?? 0) * 100).toFixed(0)}%
          </div>
        </div>
        <p className="text-xs text-dim mt-3 italic">
          Recorded as the sender described it. A reported safety concern is kept as a flag only —
          never the account of it.
        </p>
      </div>
    </div>
  );
}
