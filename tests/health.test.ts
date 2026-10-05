import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// /api/health — what an external uptime monitor actually calls. The one
// thing worth proving here: a reachable database answers 200 ok:true, the
// shape an uptime monitor will be configured to look for.

let GET: typeof import("../app/api/health/route").GET;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nightshift-pg-health-"));

beforeAll(async () => {
  process.env.PGLITE_DIR = tmp;
  delete process.env.DATABASE_URL;
  ({ GET } = await import("../app/api/health/route"));
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("GET /api/health", () => {
  it("is 200 and ok:true with a reachable database", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
