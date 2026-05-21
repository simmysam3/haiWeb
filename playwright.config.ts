import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the HAIWAVE end-to-end walkthrough.
 *
 * v1.35 follow-up #6 — canonical home for the walkthrough. The spec lives at
 * `e2e/walk.spec.ts` and exercises both HaiWeb pages/BFFs and haiCore
 * endpoints (via the gated test-seed harness in §14). It runs against an
 * externally-started stack — both `npm run dev` (HaiWeb on :3001) and the
 * haiCore Fastify app (typically :3000) must already be up, and haiCore must
 * have been started with `ENABLE_TEST_SEED=true` or `NODE_ENV=test` for §14.8
 * + §14.9 to find their seed endpoint. See `e2e/README.md` for details.
 *
 * CI integration is intentionally deferred — the full-stack bring-up is too
 * heavy for the existing GitHub Actions test job and the walkthrough is run
 * locally during the merge-verify gate.
 */
export default defineConfig({
  testDir: './e2e',
  // Run files sequentially in CI / locally; the walkthrough mutates DB state
  // (creates pending scopes) and serializing avoids cross-test interference.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    // The walkthrough reads HAIWEB_BASE_URL / HAICORE_BASE_URL itself; this
    // default mirrors the spec for any Playwright-built-in nav (e.g. trace
    // viewer URLs). Override via PLAYWRIGHT_BASE_URL on the command line.
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? process.env.HAIWEB_BASE_URL ?? 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
