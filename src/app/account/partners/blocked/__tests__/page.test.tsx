import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/account/partners/blocked',
  useRouter: () => ({ push: vi.fn() }),
}));

import BlockedCompaniesPage from '../page';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const blocked = { participant_id: 'p-acme', company_name: 'Acme Metals', blocked_at: '2026-08-01T00:00:00Z', reason: 'Repeated probing' };

describe('BlockedCompaniesPage — unblock (SEC-web-account-1-05)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('a 403 keeps the company blocked, shows no success toast, and shows the error', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (method === 'GET' && url === '/api/account/connections/blocked') return jsonResponse([blocked]);
      if (method === 'DELETE' && url.startsWith('/api/account/connections/blocked?blocked_participant_id=p-acme')) {
        return jsonResponse({ error: 'Forbidden' }, 403);
      }
      throw new Error(`unexpected fetch ${method} ${url}`);
    });
    render(<BlockedCompaniesPage />);
    await screen.findByText('Acme Metals');

    fireEvent.click(screen.getByRole('button', { name: /^unblock$/i }));
    const confirm = (await screen.findAllByRole('button', { name: /^unblock$/i })).at(-1)!;
    fireEvent.click(confirm);

    expect(await screen.findByRole('alert')).toHaveTextContent(/forbidden|permission/i);
    expect(screen.getByText('Acme Metals')).toBeInTheDocument();
    expect(screen.queryByText(/^unblocked /i)).not.toBeInTheDocument();
  });
});
