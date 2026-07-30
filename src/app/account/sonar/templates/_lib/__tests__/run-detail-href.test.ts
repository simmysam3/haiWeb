import { describe, it, expect } from 'vitest';
import { runDetailHref } from '../run-detail-href';

describe('runDetailHref', () => {
  it('audit runs land on the watcher run-detail route (no audit run page yet)', () => {
    expect(runDetailHref('audit', 'run-1')).toBe('/account/sonar/watchers/run-1');
  });

  it('phantom demand has a per-run detail page', () => {
    expect(runDetailHref('phantom_demand', 'run-1')).toBe(
      '/account/sonar/phantom-demand/runs/run-1',
    );
  });

  it('watcher has no per-run page, so it lands on the dashboard', () => {
    expect(runDetailHref('watcher', 'run-1')).toBe('/account/sonar/watcher/dashboard');
  });

  it('grounded forecasts are template-keyed, so a run has no address of its own', () => {
    expect(runDetailHref('grounded_forecast', 'run-1')).toBe(
      '/account/sonar/grounded-forecasts',
    );
  });
});
