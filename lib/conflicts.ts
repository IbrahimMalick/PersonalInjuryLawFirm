import fs from "fs";
import path from "path";
import type { ModelOutput } from "./schema";

interface AdverseParty {
  name: string;
  relationship: string;
}

let cache: AdverseParty[] | null = null;

function adverseParties(): AdverseParty[] {
  if (!cache) {
    const file = path.join(process.cwd(), "data", "adverse-parties.json");
    cache = (JSON.parse(fs.readFileSync(file, "utf8")).parties ?? []) as AdverseParty[];
  }
  return cache;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Checks the extracted parties (and the raw text as a backstop) against the
// firm's conflict list. Returns human-readable flag strings for any match.
export function checkConflicts(output: ModelOutput, rawText: string): string[] {
  const flags: string[] = [];
  const haystacks = [
    output.otherPartyInfo.name,
    output.claimant.name,
    rawText,
  ].filter((s): s is string => Boolean(s));

  for (const party of adverseParties()) {
    const needle = normalize(party.name);
    if (haystacks.some((h) => normalize(h).includes(needle))) {
      flags.push(`${party.name} — ${party.relationship}`);
    }
  }
  return flags;
}
