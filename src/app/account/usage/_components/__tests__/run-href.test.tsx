import { describe, it, expect } from 'vitest';
import { runDetailHref } from '@/app/account/sonar/templates/_lib/run-detail-href';

// The usage lists must not hand-roll run hrefs: grep-level pin plus behavior.
import fs from 'node:fs';
import path from 'node:path';

describe('usage lists route runs through the shared routing table', () => {
  for (const file of ['active-runs-list.tsx', 'throttle-history-list.tsx']) {
    it(`${file} imports runDetailHref and defines no local RUN_HREF map`, () => {
      const filePath = path.join(process.cwd(), 'src/app/account/usage/_components', file);
      const src = fs.readFileSync(filePath, 'utf8');
      expect(src).toContain("from '@/app/account/sonar/templates/_lib/run-detail-href'");
      expect(src).not.toContain('RUN_HREF');
    });
  }
  it('watcher run ids land on the watcher run page, not templates', () => {
    expect(runDetailHref('watcher', 'r1')).toBe('/account/sonar/watchers/r1');
  });
});
