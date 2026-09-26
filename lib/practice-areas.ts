import type { AnyCaseFile } from "./casefile";
import type { ConflictParty } from "./conflicts";
import { buildCaseFile, extractModelOutput, extractWithArea, type ExtractionInput } from "./extract";
import { buildCriminalCaseFile, criminalExtractor } from "./criminal";
import { buildImmigrationCaseFile, immigrationExtractor } from "./immigration";
import type { PracticeArea } from "./schema";

// The practice-area dispatch. Everything area-specific about turning an inbound
// message into a case file lives behind one function per area; the pipeline
// calls processLeadForArea() and never branches on the area itself. Adding a
// third area means writing its module and adding one entry to AREAS below —
// TypeScript won't compile until you do, and no personal-injury code changes.

export interface LeadForArea {
  input: ExtractionInput;
  /** Display name and free-text practice line — used to address the model. */
  firm: { name: string; practiceLine: string };
  rawText: string;
  parties: ConflictParty[];
  /** Immigration only: the public form's explicit "someone is detained" answer. */
  formDetained?: boolean;
  /** Criminal defense only: the public form's explicit "in custody" answer. */
  formInCustody?: boolean;
  now?: Date;
}

export interface AreaOutcome {
  caseFile: AnyCaseFile;
  draftReply: string;
  via: "live" | "fallback";
  retried: boolean;
  retryReason: string | null;
}

type AreaProcessor = (lead: LeadForArea) => Promise<AreaOutcome>;

function modelFirmName(firm: LeadForArea["firm"]): string {
  return `${firm.name} ${firm.practiceLine}`.trim();
}

const personalInjury: AreaProcessor = async (lead) => {
  const result = await extractModelOutput(lead.input, {
    firmName: modelFirmName(lead.firm),
    allowFallback: false, // a real inquiry never gets a canned answer
  });
  const built = buildCaseFile(result.output, lead.rawText, lead.parties);
  return { ...built, via: result.via, retried: result.retried, retryReason: result.retryReason };
};

const immigration: AreaProcessor = async (lead) => {
  const result = await extractWithArea(
    lead.input,
    immigrationExtractor(lead.input, modelFirmName(lead.firm)),
    { allowFallback: false }
  );
  const built = buildImmigrationCaseFile(result.output, lead.rawText, lead.parties, {
    firmName: lead.firm.name,
    now: lead.now,
    formDetained: lead.formDetained,
  });
  return { ...built, via: result.via, retried: result.retried, retryReason: result.retryReason };
};

const criminalDefense: AreaProcessor = async (lead) => {
  const result = await extractWithArea(
    lead.input,
    criminalExtractor(lead.input, modelFirmName(lead.firm)),
    { allowFallback: false }
  );
  const built = buildCriminalCaseFile(result.output, lead.rawText, lead.parties, {
    firmName: lead.firm.name,
    now: lead.now,
    formInCustody: lead.formInCustody,
  });
  return { ...built, via: result.via, retried: result.retried, retryReason: result.retryReason };
};

const AREAS: Record<PracticeArea, AreaProcessor> = {
  personal_injury: personalInjury,
  immigration,
  criminal_defense: criminalDefense,
};

export function processLeadForArea(area: PracticeArea, lead: LeadForArea): Promise<AreaOutcome> {
  return AREAS[area](lead);
}
