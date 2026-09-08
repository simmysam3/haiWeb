import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CounterpartyManifest } from '../counterparty-manifest';

// O-5 (hw-d6 walk 2026-09-07): with no counterparty manifest on file the BFF
// PUT answered a non-ok status whose body was haiCore's error ENVELOPE
// ({ error: { code, message } }); the component handed that object to the
// toast and React threw "Objects are not valid as a React child" — the
// console fell into its error boundary instead of saying anything.

function stubFetch(put: { ok: boolean; status: number; body: unknown }) {
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        return Promise.resolve({ ok: put.ok, status: put.status, json: () => Promise.resolve(put.body) } as Response);
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ lead_time_trend_sharing: 'not_required' }) } as Response);
    }),
  );
}

describe('CounterpartyManifest save degrades in place', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the on-file sentence when the BFF answers 409 with it (the handled status)', async () => {
    stubFetch({ ok: false, status: 409, body: { error: 'No counterparty manifest on file yet' } });
    render(<CounterpartyManifest />);
    fireEvent.click(screen.getByRole('button', { name: /save manifest/i }));
    expect(await screen.findByText('No counterparty manifest on file yet')).toBeTruthy();
  });

  it('renders a sentence, and does not throw, when a non-ok answer carries an error envelope instead of a string', async () => {
    stubFetch({
      ok: false,
      status: 404,
      body: { error: { code: 'NOT_FOUND', message: "No counterparty manifest found for participant 'pid'", request_id: 'r1' } },
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<CounterpartyManifest />);
    fireEvent.click(screen.getByRole('button', { name: /save manifest/i }));
    expect(await screen.findByText('The manifest could not be saved.')).toBeTruthy();
    // No React render error was raised on the way to that sentence.
    const rendered = consoleError.mock.calls.flat().map(String).join('\n');
    expect(rendered).not.toMatch(/Objects are not valid as a React child/);
  });
});
