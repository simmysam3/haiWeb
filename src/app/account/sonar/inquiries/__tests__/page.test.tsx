import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/server-fetch', () => ({
  fetchBffJson: vi.fn(async () => ({
    kind: 'ok',
    data: { rows: [{
      inquiry_id: 'inq-1', requester_participant_id: 'p-req', responder_participant_id: 'p-1',
      subjects: [{ kind: 'sku' }], attribute_class_id: 'availability', tier_at_request: 'trading_pair',
      status: 'answered', outcome: 'satisfied', commitment_id: 'cm-1', guard_trip_count: 0, created_at: '2026-09-16T00:00:00Z',
    }], next_cursor: null },
  })),
}));

import InquiriesPage from '../page';

describe('InquiriesPage', () => {
  it('defaults to the inbound tab and shows the requester participant id', async () => {
    const el = await InquiriesPage();
    render(el);
    expect(screen.getByText('p-req')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Inbound/, selected: true })).toBeInTheDocument();
  });
});
