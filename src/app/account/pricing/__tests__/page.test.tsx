import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PricingPage from '../page';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const rootNode = {
  id: 'lvl-company',
  level: 'company',
  label: 'Company Defaults',
  pricing: { currency: 'USD' },
  terms: { default_payment_terms: 'Net 30' },
  children: [
    { id: 'lvl-line-1', level: 'product_line', label: 'Fasteners', pricing: {}, terms: {} },
  ],
};

// A non-company level, so the editor offers "Reset All to Inherited".
const lineNode = { id: 'lvl-line-1', level: 'product_line', label: 'Fasteners', pricing: { currency: 'EUR' }, terms: {} };

type Answer = (url: string, init?: RequestInit) => Response | undefined;

/** URL-routed fetch double at the BFF boundary: the mount-time GET is seeded, mutations are answered by `answer`. */
function routeFetch(answer: Answer, hierarchy: unknown[] = [rootNode]) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (method === 'GET' && url === '/api/account/pricing') return jsonResponse(hierarchy);
    const res = answer(url, init);
    if (res) return res;
    throw new Error(`unexpected fetch ${method} ${url}`);
  });
}

describe('PricingPage — save and reset report the response (SEC-web-account-2-04)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('Save: a 403 shows the error and no "Saved" toast', async () => {
    routeFetch((url, init) =>
      url === '/api/account/pricing' && init?.method === 'PUT' ? jsonResponse({ error: 'Forbidden' }, 403) : undefined,
    );
    render(<PricingPage />);

    fireEvent.click(await screen.findByRole('button', { name: /^save changes$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/forbidden|permission/i);
    expect(screen.queryByText(/saved pricing for/i)).not.toBeInTheDocument();
  });

  it('Reset: a 403 shows the error and no "Reset" toast', async () => {
    routeFetch((url, init) =>
      url.startsWith('/api/account/pricing?manifest_id=lvl-line-1') && init?.method === 'DELETE'
        ? jsonResponse({ error: 'Forbidden' }, 403)
        : undefined,
    [lineNode]);
    render(<PricingPage />);

    fireEvent.click(await screen.findByRole('button', { name: /reset all to inherited/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/forbidden|permission/i);
    expect(screen.queryByText(/to inherited values/i)).not.toBeInTheDocument();
  });

  // Pin: the catch branch came in with the Save fix; this keeps it honest.
  it('Save: a request that never reaches the server says so and claims nothing saved', async () => {
    routeFetch((url, init) => {
      if (url === '/api/account/pricing' && init?.method === 'PUT') throw new TypeError('Failed to fetch');
      return undefined;
    });
    render(<PricingPage />);

    fireEvent.click(await screen.findByRole('button', { name: /^save changes$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach the server/i);
    expect(screen.queryByText(/saved pricing for/i)).not.toBeInTheDocument();
  });
});
