import Anthropic from "@anthropic-ai/sdk";
import { conductRules, REVIEW_RULES } from "./guardrails";
import { matchConflicts, type ConflictParty } from "./conflicts";
import { computeSOL } from "./sol-table";
import { fallbackFor } from "./fallbacks";
import { zModelOutput, type CaseFile, type Channel, type ModelOutput } from "./schema";

const MODEL = "claude-sonnet-4-6";

// Channel-neutral input: the demo maps its seeded leads here, the product
// maps rows from the leads table.
export interface ExtractionInput {
  id: string;
  channel: Channel | "email";
  from: string;
  displayName: string | null;
  raw: string;
  meta?: {
    durationSec?: number;
    photos?: string[];
    formFields?: Record<string, string>;
    subject?: string;
  };
  receivedLabel: string;
  breakIt?: boolean; // demo-only choreography flag
}

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

function buildPrompt(
  input: ExtractionInput,
  firmName: string,
  today: string
): { system: string; user: string } {
  const system =
    conductRules(firmName) +
    "\n" +
    OUTPUT_CONTRACT.replace("{{TODAY}}", today).replace("{{RECEIVED}}", input.receivedLabel);
  const dur = input.meta?.durationSec;
  const channelDesc: Record<string, string> = {
    voicemail: `Voicemail transcript from ${input.from}${dur ? ` (${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, "0")})` : ""}`,
    sms: `SMS from ${input.from}`,
    webform: `Website contact form submission (${input.from})`,
    whatsapp: `WhatsApp message from ${input.displayName ?? "unknown"} (${input.from})${input.meta?.photos?.length ? ` with ${input.meta.photos.length} photo attachments: ${input.meta.photos.join(", ")}` : ""}`,
    email: `Email from ${input.displayName ? `${input.displayName} <${input.from}>` : input.from}${input.meta?.subject ? ` — subject: ${input.meta.subject}` : ""}`,
  };
  return { system, user: `${channelDesc[input.channel]}:\n\n${input.raw}` };
}

// ── Defensive parsing ────────────────────────────────────────────────────────

export class ExtractionError extends Error {}

export function parseDefensively(text: string): ModelOutput {
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

// Demo-only: the "Break it" lead's first attempt is deliberately corrupted so
// the on-camera failure and retry are real code paths.
function corruptForBreakDemo(text: string): string {
  try {
    const obj = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
    obj.incidentDate = "13/45/2025";
    return JSON.stringify(obj);
  } catch {
    return text.slice(0, Math.floor(text.length / 2));
  }
}

// ── Model call ───────────────────────────────────────────────────────────────

async function fetchResponseText(
  input: ExtractionInput,
  firmName: string,
  priorError: string | null,
  allowFallback: boolean
): Promise<string> {
  const haveKey = Boolean(process.env.ANTHROPIC_API_KEY);
  if (!haveKey) {
    if (!allowFallback) {
      throw new ExtractionError("ANTHROPIC_API_KEY is not configured");
    }
    // Demo without a key: serve the cached result as the "response" so every
    // downstream path (parsing, validation, break-it) still runs for real.
    console.warn(`[nightshift] no API key — using cached result for ${input.id}`);
    const fb = fallbackFor(input.id);
    if (!fb) throw new ExtractionError(`No cached result for ${input.id}`);
    return JSON.stringify(fb);
  }

  const client = new Anthropic();
  const today = new Date().toISOString().slice(0, 10);
  const { system, user } = buildPrompt(input, firmName, today);
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

// ── Orchestration: attempt → retry once → (demo only) cached fallback ────────

export interface ExtractionResult {
  output: ModelOutput;
  via: "live" | "fallback";
  retried: boolean;
  retryReason: string | null;
}

export async function extractModelOutput(
  input: ExtractionInput,
  opts: { firmName: string; allowFallback: boolean }
): Promise<ExtractionResult> {
  const live = Boolean(process.env.ANTHROPIC_API_KEY);
  let output: ModelOutput | null = null;
  let retried = false;
  let retryReason: string | null = null;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2 && !output; attempt++) {
    try {
      let text = await fetchResponseText(
        input,
        opts.firmName,
        attempt > 0 ? (lastError?.message ?? null) : null,
        opts.allowFallback
      );
      if (input.breakIt && attempt === 0) text = corruptForBreakDemo(text);
      output = parseDefensively(text);
    } catch (e) {
      lastError = e as Error;
      if (attempt === 0) {
        retried = true;
        retryReason = lastError.message;
        console.warn(`[nightshift] attempt 1 failed for ${input.id}: ${lastError.message} — retrying`);
      }
    }
  }

  if (output) {
    return { output, via: live ? "live" : "fallback", retried, retryReason };
  }

  if (!opts.allowFallback) {
    // Product behavior: a real inquiry never gets a canned answer. The caller
    // marks the lead needs_attention and a person reads the raw message.
    throw new ExtractionError(lastError?.message ?? "Extraction failed twice");
  }

  console.warn(
    `[nightshift] falling back to cached result for ${input.id} after retry: ${lastError?.message}`
  );
  const fb = fallbackFor(input.id);
  if (!fb) throw new ExtractionError(`Extraction failed and no cached fallback for ${input.id}`);
  return { output: fb, via: "fallback", retried, retryReason };
}

// ── The trust boundary ───────────────────────────────────────────────────────
// Whatever the model said, code owns these three things:
//   1. statuteOfLimitations — computed from lib/sol-table.ts date math
//   2. conflictFlags — matched against the firm's conflict list
//   3. needsHumanReview — forced true on low confidence, conflicts, or sign_now
export function buildCaseFile(
  output: ModelOutput,
  rawText: string,
  parties: ConflictParty[]
): { caseFile: CaseFile; draftReply: string } {
  const conflictFlags = matchConflicts(output, rawText, parties);
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

// ── Demo compatibility wrapper (used by /api/demo/process) ───────────────────
import type { Lead as DemoLead } from "./schema";
import { DEMO_FIRM_NAME } from "./guardrails";
import { demoParties } from "./conflicts";

export interface ProcessResult {
  caseFile: CaseFile;
  draftReply: string;
  via: "live" | "fallback";
  retried: boolean;
  retryReason: string | null;
}

export async function processLead(lead: DemoLead): Promise<ProcessResult> {
  const result = await extractModelOutput(
    {
      id: lead.id,
      channel: lead.channel,
      from: lead.from,
      displayName: lead.displayName,
      raw: lead.raw,
      meta: lead.meta,
      receivedLabel: `${lead.receivedLabel} (overnight)`,
      breakIt: lead.breakIt,
    },
    { firmName: DEMO_FIRM_NAME, allowFallback: true }
  );
  const built = buildCaseFile(result.output, lead.raw, demoParties());
  return { ...built, via: result.via, retried: result.retried, retryReason: result.retryReason };
}
