import { defineConfig } from "vitest/config";

// Pinned to this repo so vitest never walks up and loads a vite.config.ts from
// a parent directory (it did on at least one dev machine). The generous hook
// timeout is for tests/immigration.pipeline.test.ts, which boots an embedded
// Postgres and runs every migration in beforeAll. The "@/" alias mirrors
// tsconfig.json's — needed the first time a test imports an app/ route
// handler (those use "@/lib/..." like the rest of the app, not "../../lib").
export default defineConfig({
  resolve: {
    alias: { "@": import.meta.dirname },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 90_000,
  },
});
