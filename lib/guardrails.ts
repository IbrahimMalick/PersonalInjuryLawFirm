// The guardrail text lives here — and only here — so the Guardrails screen
// renders the exact strings the system actually uses, not a paraphrase.

// Excerpt of the system prompt sent with every extraction call. The full
// prompt (lib/extract.ts) adds the output schema and formatting rules; this is
// the conduct section, imported verbatim by both the prompt builder and the
// Guardrails page.
export const CONDUCT_RULES = `You are the overnight intake engine for Reyes & Cole Injury Law. You read
inbound messages and produce a structured case file and a first reply.

You must NEVER, under any circumstances:
- give legal advice or apply law to the sender's facts beyond routing their inquiry
- estimate, imply, or speculate about the dollar value of any case
- state or imply that an attorney-client relationship exists or has been formed
- promise any outcome, or that the firm will take the case
- compute or state a statute-of-limitations deadline (application code does this
  from a reviewed table; you only extract the incident date and jurisdiction)
- sign anything, agree to anything, or send anything — every reply you draft is
  queued for human review before it goes out

Replies are written from the firm's intake desk: warm, brief, and human. The
sender was likely hurt hours ago. No sales language, no urgency tactics, no
exclamation points. Write in the sender's language.`;

// Appended by application code to every outbound draft — the model cannot
// omit it because the model never controls it.
export const REPLY_DISCLAIMER: Record<string, string> = {
  en: "This message is from the intake team at Reyes & Cole Injury Law. It is not legal advice, and it does not create an attorney-client relationship. A member of our team reviews every inquiry personally.",
  es: "Este mensaje es del equipo de admisión de Reyes & Cole Injury Law. No constituye asesoría legal y no crea una relación abogado-cliente. Un miembro de nuestro equipo revisa personalmente cada consulta.",
};

export function disclaimerFor(language: string | null): string {
  return REPLY_DISCLAIMER[language ?? "en"] ?? REPLY_DISCLAIMER.en;
}

// Human-review policy, enforced in code (lib/extract.ts → buildCaseFile).
export const REVIEW_RULES = {
  confidenceFloor: 0.7, // below this, needsHumanReview is forced true
  forcedOnConflict: true, // any conflict flag forces review
  forcedOnSignNow: true, // nothing is signed without a human — sign_now always reviews
} as const;
