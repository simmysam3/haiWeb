import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApprovalRules } from '../approval-rules';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const rules = {
  bulk: { publicly_traded: false, duns_verified: false, min_months_on_network: 0, min_score: 0, min_active_trading_pairs: 0, allowlist_ids: [] },
  per_request: { min_score: 0, allowed_business_types: [], allowed_regions: [], blocklist_ids: [], default_posture: 'manual_only' },
  contact: { email: '', phone: '' },
};

type Answer = (url: string, init?: RequestInit) => Response | undefined;

function routeFetch(answer: Answer) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (method === 'GET' && url === '/api/account/rules') return jsonResponse(rules);
    const res = answer(url, init);
    if (res) return res;
    throw new Error(`unexpected fetch ${method} ${url}`);
  });
}

describe('ApprovalRules — Test Rules (SEC-web-account-1-10)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('a 403 shows the error and renders no verdict: a browser guess is never shown as the server\'s decision', async () => {
    routeFetch((url, init) =>
      url === '/api/account/rules/test' && init?.method === 'POST' ? jsonResponse({ error: 'Forbidden' }, 403) : undefined,
    );
    render(<ApprovalRules />);

    fireEvent.click(await screen.findByRole('button', { name: /^test rules$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/forbidden|permission/i);
    // The verdict panel's exact labels (the page copy says "auto-approved" elsewhere).
    for (const verdict of ['Auto-Approve', 'Queued for Review', 'Rejected']) {
      expect(screen.queryByText(verdict)).not.toBeInTheDocument();
    }
  });
});

describe('ApprovalRules — Save Rules (SEC-web-account-1-05)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('one refused write shows the error and no success toast', async () => {
    routeFetch((url, init) => {
      if (url === '/api/account/rules' && init?.method === 'PUT') {
        const { section } = JSON.parse(String(init.body)) as { section: string };
        return section === 'per_request' ? jsonResponse({ error: 'Forbidden' }, 403) : jsonResponse({ ok: true });
      }
      return undefined;
    });
    render(<ApprovalRules />);

    fireEvent.click(await screen.findByRole('button', { name: /^save rules$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/forbidden|permission/i);
    expect(screen.queryByText(/approval rules saved/i)).not.toBeInTheDocument();
  });
});
