import Anthropic from "@anthropic-ai/sdk";
import { CONDUCT_RULES, REVIEW_RULES } from "./guardrails";
import { checkConflicts } from "./conflicts";
import { computeSOL } from "./sol-table";
import { fallbackFor } from "./fallbacks";
import { zModelOutput, type CaseFile, type Lead, type ModelOutput } from "./schema";

const MODEL = "claude-sonnet-4-6";

// The conduct rules live in lib/guardrails.ts so the Guardrails screen shows
// the real text. Below we add the output contract.
const OUTPUT_CONTRACT = `
Today's date is {{TODAY}}. Resolve relative dates ("last night", "Tuesday")
against it. The message below arrived at the firm at {{RECEIVED}}.

Respond with ONLY a single JSON object — no preamble, no markdown fences, no
commentary. Schema (all fields required; use null where unknown):

{
  "caseType": "motor_vehicle" | "premises_liability" | "dog_bite" | "medical_malpractice" | "workers_comp" | "product_liability" | "other" | "not_a_case",
  "incidentDate": "YYYY-MM-DD" | null,
  "incidentLocation": string | null,
  "claimant": { "name": string|null, "phone": string|null, "email": string|null, "preferredLanguage": string|null },
  "injuryDescription": string | null,
  "treatmentStatus": "er_visit" | "ongoing_treatment" | "saw_doctor_once" | "no_treatment" | "unknown",
  "liabilityClarity": "clear" | "disputed" | "unclear",
  "liabilityNote": string,
  "otherPartyInfo": { "name": string|null, "insurer": string|null, "policyLimits": string|null },
  "priorRepresentation": true | false | "unknown",
  "jurisdiction": string | null,
  "priorityScore": number,
  "scoreRationale": string,
  "routing": "sign_now" | "schedule_consult" | "nurture" | "decline",
  "missingInfo": string[],
  "confidence": number,
  "needsHumanReview": boolean,
  "draftReply": string
}

Field notes:
- claimant.phone: normalize spoken or spelled-out numbers to (XXX) XXX-XXXX.
- claimant.preferredLanguage: two-letter code inferred from the message ("en", "es").
- jurisdiction: two-letter US state code for where the incident happened, or null.
  Do NOT compute any deadline — that is done by application code.
- priorityScore: 0-100, how strongly the firm should want this case.
- scoreRationale: one plain-English sentence a partner would say out loud.
- routing: "sign_now" only for clear-liability, documented-injury cases;
  "decline" when there is no viable third-party claim; "nurture" when too little
  is known to evaluate.
- missingInfo: the specific questions intake still needs answered, as a human
  would phrase them.
- confidence: 0-1, your confidence in this extraction overall.
- draftReply: the first reply to the sender, in their language, following the
  conduct rules above. Do not add a signature block or disclaimer — the
  application appends the firm's standard disclaimer.`;

function buildPrompt(lead: Lead, today: string): { system: string; user: string } {
  const system = CONDUCT_RULES + "\n" + OUTPUT_CONTRACT.replace("{{TODAY}}", today).replace(
    "{{RECEIVED}}",
    `${lead.receivedLabel} (overnight)`
  );
  const channelDesc: Record<Lead["channel"], string> = {
    voicemail: `Voicemail transcript from ${lead.from}${lead.meta?.durationSec ? ` (${Math.floor(lead.meta.durationSec / 60)}:${String(lead.meta.durationSec % 60).padStart(2, "0")})` : ""}`,
    sms: `SMS from ${lead.from}`,
    webform: `Website contact form submission (${lead.from})`,
    whatsapp: `WhatsApp message from ${lead.displayName ?? "unknown"} (${lead.from})${lead.meta?.photos?.length ? ` with ${lead.meta.photos.length} photo attachments: ${lead.meta.photos.join(", ")}` : ""}`,
  };
  return { system, user: `${channelDesc[lead.channel]}:\n\n${lead.raw}` };
}

// ── Defensive parsing ────────────────────────────────────────────────────────

export class ExtractionError extends Error {}

function parseDefensively(text: string): ModelOutput {
  // Strip code fences and any prose around the outermost JSON object.
  let candidate = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    throw new ExtractionError("Response contained no JSON object");
  }
  candidate = candidate.slice(first, last + 1);

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch (e) {
    throw new ExtractionError(`Response was not valid JSON: ${(e as Error).message}`);
  }

  const result = zModelOutput.safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ExtractionError(
      `Schema validation failed at "${issue.path.join(".")}": ${issue.message}`
    );
  }
  return result.data;
}

// The "Break it" control injects a lead flagged breakIt. Its first attempt is
// deliberately corrupted before parsing — the garbled date from the SMS is
// written into incidentDate, which genuinely fails schema validation — so the
// on-camera failure and retry are real code paths, not a staged animation.
function corruptForBreakDemo(text: string): string {
  try {
    const obj = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
    obj.incidentDate = "13/45/2025";
    return JSON.stringify(obj);
  } catch {
    return text.slice(0, Math.floor(text.length / 2)); // truncated JSON also fails honestly
  }
}

// ── Model call ───────────────────────────────────────────────────────────────

async function fetchResponseText(lead: Lead, priorError: string | null): Promise<string> {
  const haveKey = Boolean(process.env.ANTHROPIC_API_KEY);
  if (!haveKey) {
    // No key configured: serve the cached result as the "response" so every
    // code path downstream (parsing, validation, the break-it choreography)
    // still runs for real. Noted on the console only.
    console.warn(`[nightshift] ANTHROPIC_API_KEY not set — using cached result for ${lead.id}`);
    const fb = fallbackFor(lead.id);
    if (!fb) throw new ExtractionError(`No cached result for ${lead.id}`);
    return JSON.stringify(fb);
  }

  const client = new Anthropic();
  const today = new Date().toISOString().slice(0, 10);
  const { system, user } = buildPrompt(lead, today);
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: user }];
  if (priorError) {
    messages.push({
      role: "user",
      content: `Your previous response failed validation: ${priorError}. Respond again with ONLY the corrected JSON object.`,
    });
  }
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system,
    messages,
  });
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new ExtractionError("Response contained no text block");
  }
  return textBlock.text;
}

// ── Orchestration: attempt → retry once → cached fallback ────────────────────

export interface ProcessResult {
  caseFile: CaseFile;
  draftReply: string;
  via: "live" | "fallback";
  retried: boolean;
  retryReason: string | null;
}

export async function processLead(lead: Lead): Promise<ProcessResult> {
  const live = Boolean(process.env.ANTHROPIC_API_KEY);
  let output: ModelOutput | null = null;
  let retried = false;
  let retryReason: string | null = null;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2 && !output; attempt++) {
    try {
      let text = await fetchResponseText(lead, attempt > 0 ? (lastError?.message ?? null) : null);
      if (lead.breakIt && attempt === 0) text = corruptForBreakDemo(text);
      output = parseDefensively(text);
    } catch (e) {
      lastError = e as Error;
      if (attempt === 0) {
        retried = true;
        retryReason = lastError.message;
        console.warn(`[nightshift] attempt 1 failed for ${lead.id}: ${lastError.message} — retrying`);
      }
    }
  }

  let via: "live" | "fallback" = live ? "live" : "fallback";
  if (!output) {
    // Both attempts failed — cached pre-computed result keeps the demo moving.
    console.warn(
      `[nightshift] falling back to cached result for ${lead.id} after retry: ${lastError?.message}`
    );
    const fb = fallbackFor(lead.id);
    if (!fb) throw new Error(`Extraction failed and no cached fallback exists for ${lead.id}`);
    output = fb;
    via = "fallback";
  }

  return { ...buildCaseFile(output, lead), via, retried, retryReason };
}

// ── The trust boundary ───────────────────────────────────────────────────────
// Whatever the model said, code owns these three things:
//   1. statuteOfLimitations — computed from lib/sol-table.ts date math
//   2. conflictFlags — matched against data/adverse-parties.json
//   3. needsHumanReview — forced true on low confidence, conflicts, or sign_now
function buildCaseFile(
  output: ModelOutput,
  lead: Lead
): { caseFile: CaseFile; draftReply: string } {
  const conflictFlags = checkConflicts(output, lead.raw);
  const statuteOfLimitations = computeSOL(
    output.incidentDate,
    output.jurisdiction,
    output.caseType
  );

  let needsHumanReview = output.needsHumanReview;
  if (output.confidence < REVIEW_RULES.confidenceFloor) needsHumanReview = true;
  if (REVIEW_RULES.forcedOnConflict && conflictFlags.length > 0) needsHumanReview = true;
  if (REVIEW_RULES.forcedOnSignNow && output.routing === "sign_now") needsHumanReview = true;

  const caseFile: CaseFile = {
    caseType: output.caseType,
    incidentDate: output.incidentDate,
    incidentLocation: output.incidentLocation,
    claimant: output.claimant,
    injuryDescription: output.injuryDescription,
    treatmentStatus: output.treatmentStatus,
    liabilityClarity: output.liabilityClarity,
    liabilityNote: output.liabilityNote,
    otherPartyInfo: output.otherPartyInfo,
    priorRepresentation: output.priorRepresentation,
    statuteOfLimitations,
    priorityScore: Math.round(output.priorityScore),
    scoreRationale: output.scoreRationale,
    routing: output.routing,
    missingInfo: output.missingInfo,
    conflictFlags,
    confidence: output.confidence,
    needsHumanReview,
  };

  return { caseFile, draftReply: output.draftReply };
}
