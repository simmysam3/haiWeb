import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AuditRun } from '@haiwave/protocol';
import { RunHeader } from '../run-header';
import { groundToken, ratioOn } from '@/test/contrast';

const baseRun = {
  run_id: 'b36c77de-9751-4802-a4cb-5f3bd5144176',
  status: 'complete',
  run_origin: 'ad_hoc',
  triggered_at: '2026-06-09T23:04:43.903Z',
  completed_at: '2026-06-09T23:05:43.903Z',
  depth_limit: 4,
  hop_count: 3,
  gap_count: 1,
  error_message: null,
  result_hash: null,
} as unknown as AuditRun;

describe('<RunHeader>', () => {
  it('titles a template-less ad-hoc run as an Ad-hoc sweep, not a bare run id', () => {
    render(<RunHeader run={baseRun} />);
    expect(
      screen.getByRole('heading', { name: 'Ad-hoc sweep — Run b36c77de' }),
    ).toBeInTheDocument();
  });

  it('titles a named run by its template name', () => {
    render(
      <RunHeader
        run={{ ...baseRun, template_name: 'jerrys first' } as unknown as AuditRun}
      />,
    );
    expect(
      screen.getByRole('heading', { name: /jerrys first/ }),
    ).toBeInTheDocument();
  });

  it('the run title clears 4.5:1 on the console ground (account/layout.tsx:26; was teal, 2.27:1)', () => {
    render(
      <main className="bg-light-gray">
        <RunHeader run={baseRun} />
      </main>,
    );
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(groundToken(h1)).toBe('light-gray');
    expect(ratioOn(h1)).toBeGreaterThanOrEqual(4.5);
  });
});
