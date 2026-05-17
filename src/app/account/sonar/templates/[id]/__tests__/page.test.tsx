import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/headers', () => ({
  cookies: async () => ({ toString: () => '' }),
  headers: async () => ({ get: () => 'localhost:3001' }),
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('TemplateDetailPage', () => {
  it('renders the template name + edit form when found', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        template: {
          template_id: 'abc',
          template_name: 'daily-audit',
          observation_class: 'audit',
          cadence: { kind: 'daily', time_of_day: '02:00' },
          enabled: true,
          retention_days: 30,
          last_run_at: null,
          created_at: new Date().toISOString(),
          scope: {
            kind: 'audit',
            authorization_basis: 'bilateral',
            counterparties: ['acme-corp'],
            signal_types: [],
            skus: [],
            depth_limit: 1,
            hop_budget: 5,
          },
        },
      }),
    } as Response);

    const Page = (await import('../page')).default;
    const ui = await Page({ params: Promise.resolve({ id: 'abc' }) });
    render(ui as React.ReactElement);
    expect(screen.getByRole('heading', { name: /daily-audit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /run now/i })).toBeInTheDocument();
    expect(await screen.findByText('acme-corp')).toBeInTheDocument();
    expect(screen.getByText(/Fixed at creation/i)).toBeInTheDocument();
  });

  it('throws NEXT_NOT_FOUND when haiCore returns 404', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 } as Response);
    const Page = (await import('../page')).default;
    await expect(Page({ params: Promise.resolve({ id: 'missing' }) })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
  });

  it('propagates a non-404 failure instead of masking it as not-found', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 } as Response);
    const Page = (await import('../page')).default;
    const err = await Page({ params: Promise.resolve({ id: 'abc' }) }).then(
      () => null,
      (e: Error) => e,
    );
    expect(err?.message).toMatch(/500/);
    expect(err?.message).not.toBe('NEXT_NOT_FOUND');
  });
});
