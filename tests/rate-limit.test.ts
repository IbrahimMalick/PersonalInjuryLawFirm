import fs from "fs";
import os from "os";
import path from "path";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

// rateLimited (lib/rate-limit.ts) — the shared Postgres-backed limiter that
// replaced two separate in-memory Maps (webform intake, signup). The thing
// worth proving: it actually blocks at the limit, isolates scopes from each
// other, and lets a scope back in once its window has passed — none of which
// an in-memory Map does across serverless instances, which is the whole
// reason this exists.

let rateLimited: typeof import("../lib/rate-limit").rateLimited;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nightshift-pg-ratelimit-"));

beforeAll(async () => {
  process.env.PGLITE_DIR = tmp;
  delete process.env.DATABASE_URL;
  ({ rateLimited } = await import("../lib/rate-limit"));
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("rateLimited", () => {
  it("allows requests under the limit, then blocks at it", async () => {
    const scope = "test:under-then-at-limit";
    for (let i = 0; i < 3; i++) {
      expect(await rateLimited(scope, 3, 60_000)).toBe(false);
    }
    expect(await rateLimited(scope, 3, 60_000)).toBe(true);
  });

  it("keeps scopes independent of each other", async () => {
    const a = "test:scope-a";
    const b = "test:scope-b";
    for (let i = 0; i < 2; i++) expect(await rateLimited(a, 2, 60_000)).toBe(false);
    expect(await rateLimited(a, 2, 60_000)).toBe(true);
    // b has seen nothing yet, so it isn't affected by a's count.
    expect(await rateLimited(b, 2, 60_000)).toBe(false);
  });

  it("lets a scope back in once its window has fully elapsed", async () => {
    const scope = "test:window-reset";
    expect(await rateLimited(scope, 1, 1)).toBe(false); // first hit, 1ms window
    await new Promise((r) => setTimeout(r, 25));
    // the prior hit is now older than the window, so it's pruned and this one counts as fresh
    expect(await rateLimited(scope, 1, 1)).toBe(false);
  });
});
