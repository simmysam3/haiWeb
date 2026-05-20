import { describe, it, expect } from 'vitest';
import { groupByPartner } from '../working-list-table';
import type { WorkingListItem } from '@haiwave/protocol';

const item = (partnerId: string | null, name: string | null, key: string): WorkingListItem => ({
  canonical_key: key.padEnd(64, '0'),
  category: 'gap',
  subject: 'subj',
  reason: 'rsn',
  item_event_time: '2026-05-20T00:00:00Z',
  partner_id: partnerId,
  partner_legal_name: name,
  action_href: '/x',
  state: 'open',
  snooze_until: null,
  dismiss_reason: null,
  last_transitioned_at: null,
});

describe('groupByPartner', () => {
  it('groups items by partner_id', () => {
    const items = [
      item('11111111-1111-1111-1111-111111111111', 'Acme', 'a'),
      item('11111111-1111-1111-1111-111111111111', 'Acme', 'b'),
      item('22222222-2222-2222-2222-222222222222', 'Beta', 'c'),
    ];
    const result = groupByPartner(items);
    expect(result).toHaveLength(2);
    expect(result[0].partnerName).toBe('Acme');
    expect(result[0].items).toHaveLength(2);
    expect(result[1].partnerName).toBe('Beta');
    expect(result[1].items).toHaveLength(1);
  });

  it('puts items with null partner_id into an "Unassigned" group at the end', () => {
    const items = [
      item(null, null, 'a'),
      item('11111111-1111-1111-1111-111111111111', 'Acme', 'b'),
    ];
    const result = groupByPartner(items);
    expect(result[0].partnerName).toBe('Acme');
    expect(result[1].partnerName).toBe('Unassigned');
  });

  it('sorts groups by item count descending', () => {
    const items = [
      item('11111111-1111-1111-1111-111111111111', 'Acme', 'a'),
      item('22222222-2222-2222-2222-222222222222', 'Beta', 'b'),
      item('22222222-2222-2222-2222-222222222222', 'Beta', 'c'),
      item('22222222-2222-2222-2222-222222222222', 'Beta', 'd'),
    ];
    const result = groupByPartner(items);
    expect(result[0].partnerName).toBe('Beta');
    expect(result[0].items).toHaveLength(3);
  });
});
