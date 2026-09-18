import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { InquiriesClient } from '../inquiries-client';
import type { InquiryLogRow } from '@/lib/safe-room-types';

const row: InquiryLogRow = {
  inquiry_id: 'inq-1', requester_participant_id: 'p-req', responder_participant_id: 'p-1',
  subjects: [{ kind: 'sku' }], attribute_class_id: 'availability', tier_at_request: 'trading_pair',
  status: 'answered', outcome: 'satisfied', commitment_id: 'cm-1', guard_trip_count: 0, created_at: '2026-09-16T00:00:00Z',
};

describe('InquiriesClient', () => {
  it('shows Load more only when a next cursor exists, fetches with it, and appends the returned rows', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ rows: [{ ...row, inquiry_id: 'inq-2' }], next_cursor: null }) }));
    render(<InquiriesClient inbound={{ rows: [row], nextCursor: 'cur-1' }} outbound={{ rows: [], nextCursor: null }} notEnabled={false} error={null} />);
    expect(screen.getByRole('button', { name: 'Load more' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/account/sonar/inquiries?direction=inbound&cursor=cur-1'));
    await waitFor(() => expect(screen.getAllByText('p-req')).toHaveLength(2)); // original row + the appended one, both fixture rows share this requester
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('shows no Load more button on the outbound tab when its next cursor is null', () => {
    render(<InquiriesClient inbound={{ rows: [row], nextCursor: 'cur-1' }} outbound={{ rows: [], nextCursor: null }} notEnabled={false} error={null} />);
    fireEvent.click(screen.getByRole('tab', { name: /Outbound/ }));
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  // PF P21 — the indicator is inbound-only; the present control is the inbound header in the same test.
  it('renders the guard-trip column on the inbound tab and not on the outbound tab', () => {
    render(<InquiriesClient inbound={{ rows: [row], nextCursor: null }} outbound={{ rows: [{ ...row, inquiry_id: 'inq-3' }], nextCursor: null }} notEnabled={false} error={null} />);
    expect(screen.getByText('Guard trip')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Outbound/ }));
    expect(screen.queryByText('Guard trip')).not.toBeInTheDocument();
  });

  // PF P15 / Q3 — what every console user sees until the portal client is granted the scope.
  it('renders the fixed not-enabled state instead of an empty table when the BFF flags it', () => {
    render(<InquiriesClient inbound={{ rows: [], nextCursor: null }} outbound={{ rows: [], nextCursor: null }} notEnabled error={null} />);
    expect(screen.getByText('Inquiry log is not enabled for this console')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });
});
