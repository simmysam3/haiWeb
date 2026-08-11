import { describe, it, expect } from 'vitest';
import { runDetailHref } from '../run-detail-href';

describe('runDetailHref', () => {
  it('routes audit runs to the audit run detail page', () => {
    expect(runDetailHref('audit', 'run-1')).toBe('/account/sonar/audit/run-1');
  });

  it('routes watcher runs to the watcher run detail page', () => {
    expect(runDetailHref('watcher', 'run-1')).toBe('/account/sonar/watchers/run-1');
  });

  it('routes phantom demand runs to the PD run page (unchanged)', () => {
    expect(runDetailHref('phantom_demand', 'run-1')).toBe(
      '/account/sonar/phantom-demand/runs/run-1',
    );
  });

  it('routes grounded forecasts to the forecast list (no per-run page by design)', () => {
    expect(runDetailHref('grounded_forecast', 'run-1')).toBe(
      '/account/sonar/grounded-forecasts',
    );
  });
});
