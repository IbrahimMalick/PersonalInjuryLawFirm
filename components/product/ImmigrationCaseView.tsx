import { splitStatusDetail } from "@/lib/casefile";
import { CURRENT_STATUS_LABEL, NOTICE_TYPE_LABEL } from "@/lib/labels";
import type { ImmigrationCaseFile } from "@/lib/immigration-schema";

// The immigration half of the lead review screen: the computed deadlines and
// the facts the sender gave. A server component — no state.
//
// The gate mirrors personal injury: facts the sender stated (a hearing date, a
// notice date) show like any case-file content, the same way PI shows the
// incident date. What stays hidden until an attorney at THIS firm acknowledges
// the deadline table is every COMPUTED deadline.

const card = "rounded-sm border border-ink-line bg-ink-raised px-5 py-4";

function yesNo(v: boolean | "unknown"): string {
  return v === "unknown" ? "unknown" : v ? "yes" : "no";
}

export function TimeCriticalBanner({ cf }: { cf: ImmigrationCaseFile }) {
  if (!cf.timeCritical) return null;
  return (
    <div className="rounded-sm border-2 border-stamp bg-stamp/15 px-5 py-3" role="alert">
      <div className="field-label text-stamp pb-1">⚠ Time-critical — call now</div>
      <p className="text-[15px] text-inktext">
        Do not queue this for morning. A person may be detained or something is due very soon.
      </p>
      <ul className="mt-1.5 space-y-0.5">
        {cf.timeCriticalReasons.map((r) => (
          <li key={r} className="text-stamp font-semibold text-[15px]">
            {r}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ImmigrationCaseView({
  cf,
  deadlinesVisible,
}: {
  cf: ImmigrationCaseFile;
  deadlinesVisible: boolean;
}) {
  const statusDetail = splitStatusDetail(cf.currentStatusDetail);
  const soonest = cf.soonestDeadline;
  const soonestUrgent = soonest?.daysRemaining != null && soonest.daysRemaining < 30;

  return (
    <div className="grid grid-cols-2 gap-3">
      <div
        className={`rounded-sm border px-5 py-4 ${
          deadlinesVisible && soonestUrgent ? "border-stamp bg-stamp/10" : "border-ink-line bg-ink-raised"
        }`}
      >
        <div className="field-label text-dim">Deadlines</div>
        {!deadlinesVisible ? (
          <p className="text-dim text-[15px] mt-2 italic">
            Hidden until an attorney reviews and acknowledges the deadline table in Settings.
          </p>
        ) : cf.deadlines.length === 0 ? (
          <p className="text-dim text-[15px] mt-2 italic">
            Nothing to compute yet — no notice, hearing, or expiration date was given.
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
                        d.daysRemaining !== null && d.daysRemaining < 30 ? "text-stamp" : "text-inktext"
                      }`}
                    >
                      {d.daysRemaining !== null && d.daysRemaining < 0
                        ? `${Math.abs(d.daysRemaining).toLocaleString()} days past`
                        : `${d.daysRemaining?.toLocaleString()} days left`}
                    </div>
                    <div className="font-mono text-sm text-dim mt-1">on {d.deadlineISO}</div>
                    {d.mailingAllowanceDays ? (
                      <div className="text-xs text-dim mt-0.5">
                        +{d.mailingAllowanceDays} days if served by mail — not included; counsel to
                        confirm
                      </div>
                    ) : null}
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
          {CURRENT_STATUS_LABEL[cf.currentStatus]}
          {statusDetail.inline ? ` · ${statusDetail.inline}` : ""}
        </div>
        {statusDetail.note && (
          <p className="text-sm text-dim mt-1.5 leading-snug">{statusDetail.note}</p>
        )}
        <div className="mt-3 space-y-1 font-mono text-sm">
          <div>
            <span className="text-dim">Citizenship · </span>
            {cf.applicant.countryOfCitizenship ?? "not stated"}
          </div>
          <div>
            <span className="text-dim">Notice · </span>
            {NOTICE_TYPE_LABEL[cf.noticeReceived.type]}
            {cf.noticeReceived.noticeDate ? ` · ${cf.noticeReceived.noticeDate}` : ""}
          </div>
          <div>
            <span className="text-dim">Pending filing · </span>
            {cf.pendingFiling.formType ?? "none stated"}
            {cf.pendingFiling.receiptNumber ? ` · ${cf.pendingFiling.receiptNumber}` : ""}
          </div>
          <div>
            <span className="text-dim">In removal proceedings · </span>
            {yesNo(cf.removal.inRemovalProceedings)}
          </div>
          <div>
            <span className="text-dim">Next hearing · </span>
            {cf.removal.nextHearingDate ?? "not stated"}
          </div>
          <div>
            <span className="text-dim">Detained · </span>
            <span className={cf.removal.isDetained === true ? "text-stamp font-semibold" : ""}>
              {yesNo(cf.removal.isDetained)}
            </span>
          </div>
          <div>
            <span className="text-dim">Status expires · </span>
            {cf.statusExpirationDate ?? "not stated"}
          </div>
          <div>
            <span className="text-dim">Sponsor · </span>
            {cf.petitionerOrSponsor.name ?? "none stated"}
            {cf.petitionerOrSponsor.relationship !== "none" &&
            cf.petitionerOrSponsor.relationship !== "unknown"
              ? ` (${cf.petitionerOrSponsor.relationship.replace("_", " ")})`
              : ""}
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
          Recorded as the sender described it — not a finding about anyone&apos;s status.
        </p>
      </div>
    </div>
  );
}
