import { describe, expect, it, vi } from "vitest";

// /api/health's failure path — Pre-Launch Audit: this route is public and
// unauthenticated, so a raw DB error (which can include connection details)
// must never reach the response body, only the server log. A separate file
// from tests/health.test.ts because it needs @/lib/db mocked to force a
// failure, which would break that file's real-PGlite happy-path test.

vi.mock("@/lib/db", () => ({
  getDb: async () => ({
    execute: async () => {
      throw new Error("connection refused: password authentication failed for db_admin@10.0.0.5");
    },
  }),
}));

describe("GET /api/health — unreachable database", () => {
  it("is 503 ok:false with no error detail in the body", async () => {
    const { GET } = await import("../app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body).not.toHaveProperty("error");
    expect(JSON.stringify(body)).not.toMatch(/password|10\.0\.0\.5|db_admin/);
  });
});
