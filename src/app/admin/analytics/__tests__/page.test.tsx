import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import AnalyticsPage from '../page';

describe('admin Connection Analytics page — absence surfaces as absence (SEC-web-admin-ops-1-05)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('a failed fetch shows a could-not-load notice and no invented rates or requesters', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'down' }), { status: 500, headers: { 'content-type': 'application/json' } }),
    );
    render(<AnalyticsPage />);

    expect(await screen.findByText(/couldn.t load/i)).toBeInTheDocument();
    // The seeded 78.5 % approval rate and the three invented top requesters.
    expect(screen.queryByText(/78\.5/)).not.toBeInTheDocument();
    expect(screen.queryByText(/National Industrial Supply/)).not.toBeInTheDocument();
  });
});
