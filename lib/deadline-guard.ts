// Deadlines are computed by code and hidden until an attorney acknowledges the
// table. The prompt forbids the model from stating one in free text, but a
// prompt is a request, not a guarantee — this is the backstop. A clause is
// removed only when it BOTH talks about a deadline AND carries a date or a
// count of days/weeks/months, so "RFE dated September 15" and "the response
// deadline is unknown" survive while "response due December 8" and "you have 84
// days" do not. It is a heuristic (English and Spanish wording); it fails safe
// by removing text, never by failing a lead.
const DEADLINE_WORDS =
  /\b(?:deadline|due|expires?|expiring|expiry|no later than|within\s+\d+|must\s+(?:be\s+)?(?:file|filed|respond|answer|submit|submitted)|\d+\s*(?:days?|weeks?|months?)\s+(?:left|remaining|to\s+(?:file|respond|answer|submit|appeal|reply))|vence|vencimiento|plazo|(?:días|semanas|meses)\s+para|le\s+quedan)\b/i;
const DATE_OR_COUNT =
  /\b\d{4}-\d{2}-\d{2}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b|\b\d{1,2}\s+de\s+[a-záéíóú]+|\b\d+\s*(?:days?|weeks?|months?|días|semanas|meses)\b/i;

export function stripStatedDeadlines(text: string): string {
  return text
    .split(/(?<=[.;!?])\s+/)
    .filter((clause) => !(DEADLINE_WORDS.test(clause) && DATE_OR_COUNT.test(clause)))
    .join(" ")
    .trim();
}
