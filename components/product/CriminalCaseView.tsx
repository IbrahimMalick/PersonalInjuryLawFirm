import type { CriminalCaseFile } from "@/lib/criminal-schema";
import {
  BAIL_STATUS_LABEL,
  CASE_STAGE_LABEL,
  HEARING_TYPE_LABEL,
  WRITER_ROLE_LABEL,
} from "@/lib/labels";

// The criminal-defense half of the lead review screen: the computed deadlines
// and the facts the sender gave. A server component — no state.
//
// There is deliberately nothing here about what happened. The case file never
// records it (lib/criminal-schema.ts), so this screen cannot show it. Facts the
// sender stated — a court date, a jail — show like any case-file content; what
// stays hidden until an attorney at THIS firm acknowledges the deadline table is
// every COMPUTED deadline.

const card = "rounded-sm border border-ink-line bg-ink-raised px-5 py-4";
const URGENT_DAYS = 7;

function yesNo(v: boolean | "unknown"): string {
  return v === "unknown" ? "unknown" : v ? "yes" : "no";
}

export default function CriminalCaseView({
  cf,
  deadlinesVisible,
}: {
  cf: CriminalCaseFile;
  deadlinesVisible: boolean;
}) {
  const soonest = cf.soonestDeadline;
  const soonestUrgent = soonest?.daysRemaining != null && soonest.daysRemaining <= URGENT_DAYS;
  const court = [cf.court.courtName, cf.court.jurisdiction].filter(Boolean).join(" · ");

  return (
    <div className="grid grid-cols-2 gap-3">
      <div
        className={`rounded-sm border px-5 py-4 ${
          deadlinesVisible && soonestUrgent ? "border-stamp bg-stamp/10" : "border-ink-line bg-ink-raised"
        }`}
      >
        <div className="field-label text-dim">Deadlines &amp; court dates</div>
        {!deadlinesVisible ? (
          <p className="text-dim text-[15px] mt-2 italic">
            Hidden until an attorney reviews and acknowledges the deadline table in Settings.
          </p>
        ) : cf.deadlines.length === 0 ? (
          <p className="text-dim text-[15px] mt-2 italic">
            Nothing to compute yet — no court date, arrest date, or conviction date was given.
          </p>
        ) : (
          <ul className="mt-2 space-y-3">
            {cf.deadlines.map((d) => (
              <li key={d.trigger} className="border-t border-ink-line pt-2 first:border-t-0 first:pt-0">
                <div className="text-inktext text-[15px] font-semibold">{d.label}</div>
                {d.kind === "computed" ? (
                  <>
                    <div
                      className={`font-mono font-semibold text-3xl tabular-nums leading-none mt-1 ${
                        d.daysRemaining !== null && d.daysRemaining <= URGENT_DAYS
                          ? "text-stamp"
                          : "text-inktext"
                      }`}
                    >
                      {d.daysRemaining !== null && d.daysRemaining < 0
                        ? `${Math.abs(d.daysRemaining).toLocaleString()} days past`
                        : `${d.daysRemaining?.toLocaleString()} days left`}
                    </div>
                    <div className="font-mono text-sm text-dim mt-1">on {d.deadlineISO}</div>
                  </>
                ) : null}
                <div className="text-sm text-dim mt-1">{d.basis}</div>
              </li>
            ))}
          </ul>
        )}
        <div className="field-label text-manila mt-3">
          Computed by table + date math — never by the model
        </div>
      </div>

      <div className={card}>
        <div className="field-label text-dim">What the sender told us</div>
        <div className="font-display font-bold uppercase tracking-wide text-2xl mt-2 text-inktext">
          {CASE_STAGE_LABEL[cf.court.caseStage]}
        </div>
        <div className="mt-3 space-y-1 font-mono text-sm">
          <div>
            <span className="text-dim">Writing in · </span>
            {WRITER_ROLE_LABEL[cf.writerRole]}
          </div>
          {cf.defendantName && (
            <div>
              <span className="text-dim">Person charged · </span>
              {cf.defendantName}
            </div>
          )}
          <div>
            <span className="text-dim">In custody · </span>
            <span className={cf.custody.inCustody === true ? "text-stamp font-semibold" : ""}>
              {yesNo(cf.custody.inCustody)}
            </span>
            {cf.custody.heldAt ? ` · ${cf.custody.heldAt}` : ""}
          </div>
          <div>
            <span className="text-dim">Bail · </span>
            {BAIL_STATUS_LABEL[cf.custody.bailStatus]}
          </div>
          <div>
            <span className="text-dim">Arrested · </span>
            {cf.custody.arrestDate ?? "not stated"}
          </div>
          <div>
            <span className="text-dim">Charges (as named) · </span>
            {cf.chargesStated.length > 0 ? cf.chargesStated.join(", ") : "not stated"}
          </div>
          <div>
            <span className="text-dim">Court · </span>
            {court || "not stated"}
          </div>
          <div>
            <span className="text-dim">Next date · </span>
            {cf.court.nextCourtDate
              ? `${cf.court.nextCourtDate} (${HEARING_TYPE_LABEL[cf.court.hearingType]})`
              : "not stated"}
          </div>
          {cf.court.convictionDate && (
            <div>
              <span className="text-dim">Conviction · </span>
              {cf.court.convictionDate}
            </div>
          )}
          <div>
            <span className="text-dim">Active warrant · </span>
            <span className={cf.hasActiveWarrant === true ? "text-stamp font-semibold" : ""}>
              {yesNo(cf.hasActiveWarrant)}
            </span>
          </div>
          <div>
            <span className="text-dim">Probation / parole · </span>
            {yesNo(cf.onProbationOrParole)}
          </div>
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
          Recorded as the sender described it. Nightshift does not record what happened — the
          attorney takes that on a privileged call.
        </p>
      </div>
    </div>
  );
}
