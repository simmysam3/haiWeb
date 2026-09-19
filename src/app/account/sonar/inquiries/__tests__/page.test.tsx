import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const ENABLED_ROW = {
  rows: [{
    inquiry_id: 'inq-1', requester_participant_id: 'p-req', responder_participant_id: 'p-1',
    subjects: [{ kind: 'sku' }], attribute_class_id: 'availability', tier_at_request: 'trading_pair',
    status: 'answered', outcome: 'satisfied', commitment_id: 'cm-1', guard_trip_count: 0, created_at: '2026-09-16T00:00:00Z',
  }], next_cursor: null,
};
const NOT_ENABLED = { rows: [], next_cursor: null, not_enabled: true as const };

describe('InquiriesPage', () => {
  it('defaults to the inbound tab and shows the requester participant id', async () => {
    vi.resetModules();
    vi.doMock('@/lib/server-fetch', () => ({ fetchBffJson: vi.fn(async () => ({ kind: 'ok', data: ENABLED_ROW })) }));
    const { default: InquiriesPage } = await import('../page');
    const el = await InquiriesPage();
    render(el);
    expect(screen.getByText('p-req')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Inbound/, selected: true })).toBeInTheDocument();
  });

  // Item 19 (final fix wave): the page-level composition `(inbound.not_enabled ||
  // outbound.not_enabled)` (page.tsx:14) had no test — only the InquiriesClient prop itself was
  // tested true/false. Only ONE direction is not_enabled here, so inverting the OR to an AND
  // would stay green against a fixture where both are refused, but fails this one.
  it('treats either direction being scope-refused as the whole surface not enabled', async () => {
    vi.resetModules();
    vi.doMock('@/lib/server-fetch', () => ({
      fetchBffJson: vi.fn(async (path: string) => ({
        kind: 'ok',
        data: path.includes('outbound') ? NOT_ENABLED : ENABLED_ROW,
      })),
    }));
    const { default: InquiriesPage } = await import('../page');
    const el = await InquiriesPage();
    render(el);
    expect(screen.getByText('Inquiry log is not enabled for this console')).toBeInTheDocument();
  });
});
