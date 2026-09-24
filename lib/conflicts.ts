import type { ModelOutput } from "./schema";

export interface ConflictParty {
  name: string;
  relationship: string;
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

// The shared core: each practice area supplies the extracted names worth
// checking, and the raw text is a backstop. Pure function — callers supply the
// list: the demo loads data/adverse-parties.json, the product loads the
// adverse_parties table. Returns human-readable flag strings for any match.
export function matchNames(
  names: (string | null | undefined)[],
  rawText: string,
  parties: ConflictParty[]
): string[] {
  const flags: string[] = [];
  const haystacks = [...names, rawText].filter((s): s is string => Boolean(s));

  for (const party of parties) {
    const needle = normalize(party.name);
    if (!needle) continue;
    if (haystacks.some((h) => normalize(h).includes(needle))) {
      flags.push(`${party.name} — ${party.relationship}`);
    }
  }
  return flags;
}

// Personal injury: the other party and the claimant.
export function matchConflicts(
  output: ModelOutput,
  rawText: string,
  parties: ConflictParty[]
): string[] {
  return matchNames([output.otherPartyInfo.name, output.claimant.name], rawText, parties);
}

// Demo-only: the checked-in illustrative conflict list.
export function demoParties(): ConflictParty[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs") as typeof import("fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("path") as typeof import("path");
  const file = path.join(process.cwd(), "data", "adverse-parties.json");
  return (JSON.parse(fs.readFileSync(file, "utf8")).parties ?? []) as ConflictParty[];
}
