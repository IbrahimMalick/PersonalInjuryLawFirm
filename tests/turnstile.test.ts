import { afterEach, describe, expect, it, vi } from "vitest";

// verifyTurnstile (lib/turnstile.ts) — must fail closed: no token, no
// secret, a non-success response, or a network error should all come back
// false, never silently pass.

describe("verifyTurnstile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TURNSTILE_SECRET_KEY;
  });

  it("fails closed when TURNSTILE_SECRET_KEY isn't set, without making a request", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { verifyTurnstile } = await import("../lib/turnstile");
    expect(await verifyTurnstile("some-token")).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fails closed when no token is given", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { verifyTurnstile } = await import("../lib/turnstile");
    expect(await verifyTurnstile("")).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns true only when Cloudflare reports success", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ json: async () => ({ success: true }) }))
    );
    const { verifyTurnstile } = await import("../lib/turnstile");
    expect(await verifyTurnstile("good-token")).toBe(true);
  });

  it("fails closed when Cloudflare reports failure", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ json: async () => ({ success: false, "error-codes": ["invalid-input-response"] }) }))
    );
    const { verifyTurnstile } = await import("../lib/turnstile");
    expect(await verifyTurnstile("bad-token")).toBe(false);
  });

  it("fails closed on a network error, rather than throwing", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );
    const { verifyTurnstile } = await import("../lib/turnstile");
    await expect(verifyTurnstile("some-token")).resolves.toBe(false);
  });
});
