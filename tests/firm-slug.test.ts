import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// createFirm's slug-collision retry (lib/firm.ts) — Pre-Launch Audit blocker
// 3. The retry loop's guard checked `String(e).includes("UNIQUE")`, but
// Postgres's actual wording is lowercase ("duplicate key value violates
// unique constraint ...") nested under the driver's own wrapped error as
// `.cause` — so the guard never matched either way, the retry loop was dead
// code, and a second firm with a colliding name threw an unhandled error
// straight to the signup form. This proves the real failure mode (two firms
// named identically) now succeeds with a disambiguated slug instead.

let createFirm: typeof import("../lib/firm").createFirm;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nightshift-pg-firm-slug-"));

beforeAll(async () => {
  process.env.PGLITE_DIR = tmp;
  delete process.env.DATABASE_URL;
  await (await import("../lib/db")).getDb();
  ({ createFirm } = await import("../lib/firm"));
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("createFirm slug collisions", () => {
  it("gives a second firm with the identical name a disambiguated slug instead of throwing", async () => {
    const first = await createFirm("Smith Law", "", "personal_injury");
    expect(first.slug).toBe("smith-law");

    const second = await createFirm("Smith Law", "", "personal_injury");
    expect(second.slug).toBe("smith-law-2");
    expect(second.id).not.toBe(first.id);

    const third = await createFirm("Smith Law", "", "personal_injury");
    expect(third.slug).toBe("smith-law-3");
  });

  it("leaves genuinely different firms with their own base slugs", async () => {
    const a = await createFirm("Jones & Partners", "", "personal_injury");
    const b = await createFirm("Garcia Legal", "", "personal_injury");
    expect(a.slug).toBe("jones-and-partners");
    expect(b.slug).toBe("garcia-legal");
  });
});
