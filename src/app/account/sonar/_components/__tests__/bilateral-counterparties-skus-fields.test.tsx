import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BilateralCounterpartiesSkusFields } from '../bilateral-counterparties-skus-fields';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('BilateralCounterpartiesSkusFields empty state', () => {
  it('uses modality-neutral nomination language (this control is shared by the watcher wizard, not just audit)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ counterparties: [] }),
      })),
    );

    const { container } = render(
      <BilateralCounterpartiesSkusFields counterparties={[]} skus={[]} onChange={() => {}} />,
    );

    // The empty-state still points users at the nomination flow…
    await screen.findByText(/New nomination/i);
    expect(container.textContent).toMatch(/accepted a nomination/i);
    // …but must not call it an "audit" — on the watcher page that is the wrong
    // modality (Sam's report: "it is not an audit because I am on watchers").
    expect(container.textContent).not.toMatch(/audit/i);
  });
});
