import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PricingDefaults } from '../pricing-defaults';

// Same mechanism as O-5 on the pricing save (agent1's calibrated census,
// 2026-09-08): a non-ok PUT /api/account/manifests answer whose body is a
// relayed haiCore envelope reached the toast as an OBJECT and React threw.

function stubFetch(put: { ok: boolean; status: number; body: unknown }) {
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        return Promise.resolve({ ok: put.ok, status: put.status, json: () => Promise.resolve(put.body) } as Response);
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response);
    }),
  );
}

describe('PricingDefaults save degrades in place', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the BFF sentence when the answer carries a string error (control)', async () => {
    stubFetch({ ok: false, status: 400, body: { error: 'Quote validity must be a whole number of days.' } });
    render(<PricingDefaults />);
    fireEvent.click(screen.getByRole('button', { name: /save pricing/i }));
    expect(await screen.findByText('Quote validity must be a whole number of days.')).toBeTruthy();
  });

  it('renders a sentence, and does not throw, when a non-ok answer carries an error envelope instead of a string', async () => {
    stubFetch({
      ok: false,
      status: 403,
      body: { error: { code: 'FORBIDDEN', message: 'pricing manifest writes need account_admin', request_id: 'r2' } },
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<PricingDefaults />);
    fireEvent.click(screen.getByRole('button', { name: /save pricing/i }));
    expect(await screen.findByText('The pricing defaults could not be saved.')).toBeTruthy();
    const rendered = consoleError.mock.calls.flat().map(String).join('\n');
    expect(rendered).not.toMatch(/Objects are not valid as a React child/);
  });
});
