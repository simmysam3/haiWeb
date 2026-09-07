import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import AbusePage from '../page';

describe('admin Ban & Abuse page — absence surfaces as absence (SEC-web-admin-ops-1-05)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('a failed fetch shows a could-not-load notice and no fabricated counts', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'down' }), { status: 500, headers: { 'content-type': 'application/json' } }),
    );
    render(<AbusePage />);

    expect(await screen.findByText(/couldn.t load/i)).toBeInTheDocument();
    // The seeded "3 active blocks / 2 in 30 days" that used to stand in for the network.
    expect(screen.queryByText(/^3$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^2$/)).not.toBeInTheDocument();
  });
});
