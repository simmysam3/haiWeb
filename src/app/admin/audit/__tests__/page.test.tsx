import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import AuditPage from '../page';

describe('admin Audit Log page — absence surfaces as absence (SEC-web-admin-ops-1-05)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('a failed fetch shows a could-not-load notice and no fabricated events', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'content-type': 'application/json' } }),
    );
    render(<AuditPage />);

    expect(await screen.findByText(/couldn.t load/i)).toBeInTheDocument();
    // The seeded rows that used to stand in for the audit trail.
    expect(screen.queryByText(/admin\.suspend/)).not.toBeInTheDocument();
    expect(screen.queryByText(/admin-1/)).not.toBeInTheDocument();
    expect(screen.queryByText(/3 events/)).not.toBeInTheDocument();
  });
});
