import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AttributeClassesClient } from '../attribute-classes-client';
import type { AttributeClassProposalRow, AttributeClassSummary } from '@/lib/safe-room-types';

const classes: AttributeClassSummary[] = [{
  attribute_class_id: 'availability', display_name: 'Availability', status: 'adopted',
  default_disclosure: { unknown: 'declined', behavioral_only: 'declined', trading_pair: 'qualified', premier_partner: 'raw' },
}];

const CREATED: AttributeClassProposalRow = {
  id: 'prop-2', proposer_participant_id: 'p-1', attribute_class_id: 'moq',
  proposed_shape: {
    attribute_class_id: 'moq', display_name: 'MOQ', subject_types: ['sku'], value_type: 'integer', unit: null,
    operators_allowed: ['eq'],
    default_disclosure: { unknown: 'declined', behavioral_only: 'declined', trading_pair: 'declined', premier_partner: 'declined' },
    granularity_ceiling: { unknown: 'aggregate', behavioral_only: 'aggregate', trading_pair: 'aggregate', premier_partner: 'aggregate' },
    pass_only: false, extractor: 'none', confidence_floor: null, evidence_element_key: null, evidence_document_type: null,
    informational_use_only: true, attribute_class_evaluation_rule: null,
  },
  status: 'pending', decision_reason: null, decided_by: null, decided_at: null, adopted_attribute_class_id: null,
  created_at: '2026-09-18T00:00:00Z',
};

function proposeMoq() {
  fireEvent.change(screen.getByLabelText('Attribute class id'), { target: { value: 'moq' } });
  fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'MOQ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Propose' }));
}

describe('AttributeClassesClient', () => {
  it('appends the proposal returned from a successful POST', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ proposal: CREATED }) }));
    render(<AttributeClassesClient classes={classes} initialProposals={[]} />);
    proposeMoq();
    await waitFor(() => expect(screen.getByText(/MOQ — pending/)).toBeInTheDocument());
  });

  // Final fix wave item 1: a rejected proposal must not fail silently — `if (!res.ok) return;`
  // dropped every backend rejection with no error and no toast (the same class Batch 1's I1
  // fixed on disclosure-policy-client.tsx). This pins the `putOrFail` shape applied here.
  it('shows an alert and adds no row when the proposal POST is rejected', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => 'Invalid proposal' }));
    render(<AttributeClassesClient classes={classes} initialProposals={[]} />);
    proposeMoq();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.queryByText(/MOQ — pending/)).not.toBeInTheDocument();
  });
});
