import { fmtDateTime } from "@/lib/format";

// Internal team coordination on a lead — "called, left voicemail," that kind
// of note. Separate from the audit trail: the audit trail is a system record
// of what the app did; this is what a person chose to tell their teammates.
// Never sent to the client. Append-only, same as the audit trail.

export interface LeadNote {
  id: number;
  body: string;
  createdAt: string;
  authorName: string | null;
}

export default function LeadNotesPanel({
  leadId,
  notes,
  timezone,
  addNote,
}: {
  leadId: string;
  notes: LeadNote[];
  timezone: string;
  addNote: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="rounded-sm border border-ink-line bg-ink-raised px-5 py-4">
      <div className="field-label text-dim pb-2">Internal notes — never sent to the client</div>
      {notes.length > 0 && (
        <ul className="space-y-3 mb-3">
          {notes.map((n) => (
            <li key={n.id} className="border-t border-ink-line pt-2.5 first:border-t-0 first:pt-0">
              <div className="font-mono text-xs text-dim">
                {n.authorName ?? "Former team member"} · {fmtDateTime(n.createdAt, timezone)}
              </div>
              <p className="text-[15px] text-inktext/90 whitespace-pre-line mt-0.5">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
      <form action={addNote} className="flex items-start gap-2">
        <input type="hidden" name="leadId" value={leadId} />
        <textarea
          name="body"
          rows={2}
          maxLength={4000}
          placeholder="Called, left a voicemail…"
          className="flex-1 rounded-sm border border-ink-line bg-ink px-3 py-2 text-[14px] text-inktext placeholder:text-dim focus:outline focus:outline-2 focus:outline-manila"
        />
        <button className="rounded-sm border-2 border-ink-line text-inktext font-display font-bold uppercase tracking-wider text-sm px-4 py-2 hover:border-manila hover:text-manila shrink-0">
          Add note
        </button>
      </form>
    </div>
  );
}
