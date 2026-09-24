import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Pill, definitionFor } from '../pill';
import {
  SmCandidateLiveStatusSchema, SmExecutionStatusSchema, ClassSuggestionBandSchema, SmBomSourceSchema, UtilizationBandSchema,
} from '@/lib/sourcing-map/contract';

function tipText(): string {
  const pill = screen.getByTestId('pill');
  return document.getElementById(pill.getAttribute('aria-describedby') as string)?.textContent ?? '';
}

describe('<Pill themed> (Sourcing Map)', () => {
  it('<Pill> dark variants resolve definitions', () => {
    render(<Pill themed category="sm_candidate_status" value="timeout" />);
    const pill = screen.getByTestId('pill');
    expect(pill.className).toContain('bg-[var(--sm-pill-warn-bg)]');
    expect(pill.className).toContain('text-[var(--sm-pill-warn-fg)]');
    expect(pill.className).not.toContain('bg-warning/10');
    expect(tipText()).toMatch(/did not answer within/i);
    expect(screen.getByText('Timeout')).toBeInTheDocument();
  });

  it('every Sourcing Map pill value resolves a definition (no dev warning on the map)', () => {
    const cases: Array<[string, readonly string[]]> = [
      ['sm_candidate_status', SmCandidateLiveStatusSchema.options],
      ['sm_execution_status', SmExecutionStatusSchema.options],
      ['sm_band', ClassSuggestionBandSchema.options],
      ['sm_bom_source', SmBomSourceSchema.options],
      ['sm_utilization', UtilizationBandSchema.options],
      ['sm_readiness', ['ready', 'not_ready']],
      ['sm_match', ['exact', 'high', 'low', 'not_on_network', 'not_a_trading_partner', 'ambiguous']],
    ];
    const missing = cases.flatMap(([cat, values]) => values.filter((v) => !definitionFor(cat, v)).map((v) => `${cat}:${v}`));
    expect(missing).toEqual([]);
  });
});
