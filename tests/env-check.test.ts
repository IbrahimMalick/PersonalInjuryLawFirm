import { describe, expect, it } from "vitest";
import { assertRequiredEnv, MissingEnvError, REQUIRED_IN_PRODUCTION } from "../lib/env-check";

// assertRequiredEnv (lib/env-check.ts) — boot-time guard for the 3 env vars
// with no legitimate "unset" production mode. Takes an env object as a
// parameter specifically so it's testable without touching process.env.

const fullEnv: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  DATABASE_URL: "postgres://x",
  CRON_SECRET: "secret",
  PUBLIC_BASE_URL: "https://example.com",
};

describe("assertRequiredEnv", () => {
  it("passes silently when all required vars are present in production", () => {
    expect(() => assertRequiredEnv(fullEnv)).not.toThrow();
  });

  it("throws MissingEnvError naming exactly the missing vars", () => {
    const { CRON_SECRET: _drop, ...rest } = fullEnv;
    void _drop;
    try {
      assertRequiredEnv(rest);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(MissingEnvError);
      expect((err as InstanceType<typeof MissingEnvError>).missing).toEqual(["CRON_SECRET"]);
    }
  });

  it("lists every missing var when several are absent", () => {
    try {
      assertRequiredEnv({ NODE_ENV: "production" });
      expect.unreachable();
    } catch (err) {
      expect((err as InstanceType<typeof MissingEnvError>).missing).toEqual([...REQUIRED_IN_PRODUCTION]);
    }
  });

  it("is a no-op outside production", () => {
    expect(() => assertRequiredEnv({ NODE_ENV: "development" })).not.toThrow();
    expect(() => assertRequiredEnv({ NODE_ENV: "test" })).not.toThrow();
  });

  it("is a no-op in production demo mode, even with nothing set", () => {
    expect(() =>
      assertRequiredEnv({ NODE_ENV: "production", NIGHTSHIFT_MODE: "demo" })
    ).not.toThrow();
  });
});
