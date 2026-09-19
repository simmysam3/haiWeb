import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AttributeClassesClient } from '../attribute-classes-client';
import type { AttributeClassProposalRow, AttributeClassSummary } from '@/lib/safe-room-types';

// N1 (re-review): a plain mock object has no `clone()`, so `describeApiError`'s
// `res.clone().json()` throws and falls back to the generic per-status text. Same helper shape
// as partners-panel-activation.test.tsx / partners-panel-premier.test.tsx (repo convention: a
// file-local copy, not a shared import — no shared test-util module exports one).
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

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
  //
  // N1 (re-review): the alert must show haiCore's parsed `error.message`, never the raw envelope
  // ({ error: { code, message, timestamp, request_id } }, lib/reply.ts:23-31) — the exact defect
  // item 22 removed from disclosure-policy-client.tsx, left unfixed here.
  it('shows haiCore\'s error.message (not the raw envelope) and adds no row when the proposal POST is rejected', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid proposal', timestamp: '2026-09-18T00:00:00Z', request_id: 'req-1' } },
      400,
    )));
    render(<AttributeClassesClient classes={classes} initialProposals={[]} />);
    proposeMoq();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Invalid proposal');
    expect(alert).not.toHaveTextContent('request_id');
    expect(alert).not.toHaveTextContent('VALIDATION_ERROR');
    expect(screen.queryByText(/MOQ — pending/)).not.toBeInTheDocument();
  });

  // N1 (re-review): item 12's exact defect, unfixed on this surface — a thrown fetch (offline,
  // DNS) must show the same alert, not escape as an unhandled rejection.
  it('shows an alert and adds no row when the proposal fetch itself throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    render(<AttributeClassesClient classes={classes} initialProposals={[]} />);
    proposeMoq();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.queryByText(/MOQ — pending/)).not.toBeInTheDocument();
  });

  // N1 (re-review): the addendum's exact defect, unfixed on this surface — a malformed 2xx body
  // must not escape res.json() as an unhandled rejection, and must not clear a prior alert either.
  it('shows an alert and adds no row when the proposal POST response body cannot be parsed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError('bad json'); } }));
    render(<AttributeClassesClient classes={classes} initialProposals={[]} />);
    proposeMoq();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.queryByText(/MOQ — pending/)).not.toBeInTheDocument();
  });

  // N1 (re-review): a 2xx body that parses but carries no `proposal` must not store `undefined`
  // into the list (the render at `p.proposed_shape.display_name` would then throw) — keep prior
  // state and show an alert instead. The existing row's display name is deliberately NOT "MOQ"
  // (the one just submitted) and the check is scoped to the "Your proposals" list specifically
  // (via `within`), so this can only pass by the list staying at exactly its one prior entry —
  // not by that entry's text merely still being somewhere on the page.
  it('shows an alert and keeps exactly the prior row when the proposal POST response has no proposal', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})));
    const existing: AttributeClassProposalRow = { ...CREATED, id: 'prop-1', proposed_shape: { ...CREATED.proposed_shape, display_name: 'Existing Class' } };
    render(<AttributeClassesClient classes={classes} initialProposals={[existing]} />);
    proposeMoq();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    const list = screen.getByRole('heading', { name: 'Your proposals' }).parentElement!.querySelector('ul')!;
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(within(list).getByText(/Existing Class — pending/)).toBeInTheDocument();
  });
});
