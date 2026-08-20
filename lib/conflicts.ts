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

// Checks the extracted parties (and the raw text as a backstop) against the
// firm's conflict list. Pure function — callers supply the list: the demo
// loads data/adverse-parties.json, the product loads the adverse_parties
// table. Returns human-readable flag strings for any match.
export function matchConflicts(
  output: ModelOutput,
  rawText: string,
  parties: ConflictParty[]
): string[] {
  const flags: string[] = [];
  const haystacks = [output.otherPartyInfo.name, output.claimant.name, rawText].filter(
    (s): s is string => Boolean(s)
  );

  for (const party of parties) {
    const needle = normalize(party.name);
    if (!needle) continue;
    if (haystacks.some((h) => normalize(h).includes(needle))) {
      flags.push(`${party.name} — ${party.relationship}`);
    }
  }
  return flags;
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
