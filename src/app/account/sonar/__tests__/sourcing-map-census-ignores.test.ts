import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(__dirname, '..', '..', '..', '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

/** R-10 census I4: each create flow sends its own class, so none can create a sourcing_map run. */
const CREATE_FLOWS: Array<[string, string]> = [
  ['app/account/sonar/templates/_components/template-wizard.tsx', "const OBSERVATION_CLASS = 'phantom_demand'"],
  ['app/account/sonar/audit/new/_components/audit-wizard.tsx', "observation_class: 'audit'"],
  ['app/account/sonar/watchers/new/_components/watcher-wizard.tsx', "observation_class: 'watcher'"],
  ['app/account/sonar/grounded-forecasts/new/_components/forecast-wizard.tsx', "'/api/account/sonar/grounded-forecasts'"],
  ['app/account/partners/partners-panel.tsx', 'observation_class=phantom_demand'],
  ['app/account/sonar/observations/_components/phantom-demand-queue.tsx', 'observation_class=phantom_demand'],
];

/** R-10 census I8: template id → name maps that never switch on the class. */
const NAME_MAPS = ['app/api/account/sonar/dashboard/activity/route.ts', 'app/api/account/sonar/audit/runs/route.ts'];

function* appSources(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      yield* appSources(full);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      yield full;
    }
  }
}

describe('R-10 census: consumers that ignore sourcing_map', () => {
  it('I4: every other create flow carries its own class and never sourcing_map', () => {
    for (const [file, own] of CREATE_FLOWS) {
      const src = read(file);
      expect(src, file).toContain(own);
      expect(src, file).not.toContain('sourcing_map');
    }
  });

  it('I6: no console link opens the observations list on a sourcing_map tab (present control: tab=audit)', () => {
    const tabs = new Map<string, string>();
    for (const file of appSources(join(SRC, 'app'))) {
      for (const m of readFileSync(file, 'utf8').matchAll(/observations\?tab=([a-z_]+)/g)) tabs.set(`${relative(SRC, file)}:${m.index}`, m[1]!);
    }
    expect([...tabs.values()]).toContain('audit');
    expect([...tabs.values()]).not.toContain('sourcing_map');
  });

  it('I8: the template-name maps read no observation_class (present control: they list templates)', () => {
    for (const file of NAME_MAPS) {
      const src = read(file);
      expect(src, file).toContain('listRunTemplates(');
      expect(src, file).not.toContain('observation_class');
    }
  });
});
