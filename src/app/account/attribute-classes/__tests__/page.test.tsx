import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// PF P7 + PF P9: the as-built envelopes and the as-built proposal row.
vi.mock('@/lib/server-fetch', () => ({
  fetchBffJson: vi.fn(async (path: string) => {
    if (path.includes('/proposals')) {
      return { kind: 'ok', data: { proposals: [{
        id: 'prop-1', proposer_participant_id: 'p-1', attribute_class_id: 'moq',
        proposed_shape: { attribute_class_id: 'moq', display_name: 'MOQ', value_type: 'integer' },
        status: 'pending', decision_reason: null, decided_by: null, decided_at: null,
        adopted_attribute_class_id: null, created_at: '2026-09-16T00:00:00Z',
      }] } };
    }
    return { kind: 'ok', data: { attribute_classes: [{ attribute_class_id: 'availability', display_name: 'Availability', status: 'adopted', default_disclosure: { unknown: 'declined', behavioral_only: 'declined', trading_pair: 'qualified', premier_partner: 'raw' } }] } };
  }),
}));

import AttributeClassesPage from '../page';

describe('AttributeClassesPage', () => {
  it("lists adopted classes and the participant's own proposals", async () => {
    const el = await AttributeClassesPage();
    render(el);
    expect(screen.getByText('Availability')).toBeInTheDocument();
    expect(screen.getByText(/MOQ/)).toBeInTheDocument();
    expect(screen.getByText(/pending/)).toBeInTheDocument();
  });
});
