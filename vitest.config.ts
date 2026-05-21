import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: false,
    // The Playwright walkthrough lives in `e2e/` and uses @playwright/test —
    // not vitest. Vitest's default include picks up `*.spec.ts`, so explicitly
    // exclude the e2e tree here. Invoke Playwright via `npm run test:e2e`.
    //
    // `.worktrees/` holds checked-out feature branches with their own
    // `node_modules/` — without this exclude vitest re-runs every test in
    // every active worktree (stale React versions in those trees cause
    // spurious failures and the run inflates ~3x). v1.37 polish add.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', 'e2e/**', '.worktrees/**'],
  },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname ?? '.', 'src') },
  },
});
