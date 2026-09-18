import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DisclosurePolicyClient } from '../disclosure-policy-client';
import type { AttributeClassSummary, DisclosurePolicyResponse } from '@/lib/safe-room-types';

const COUNTERPARTY = '11111111-1111-4111-8111-111111111111';
const classes: AttributeClassSummary[] = [{ attribute_class_id: 'availability', display_name: 'Availability', status: 'adopted', default_disclosure: { unknown: 'declined', behavioral_only: 'declined', trading_pair: 'qualified', premier_partner: 'raw' } }];
const policy: DisclosurePolicyResponse = { matrix: [] };

describe('DisclosurePolicyClient', () => {
  it('PUTs the whole cell to the main route when no counterparty is set', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ row: { attribute_class_id: 'availability', trust_class: 'trading_pair', disclosure: 'raw', disclose_shortfall_quantity: false, source: 'participant' } }) }));
    render(<DisclosurePolicyClient classes={classes} policy={policy} participation={{ global: true, per_class: {} }} overrides={[]} counterparty={null} />);
    fireEvent.change(screen.getByLabelText('availability disclosure for trading_pair'), { target: { value: 'raw' } });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/account/disclosure-policy', expect.objectContaining({ method: 'PUT' })));
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string);
    expect(body).toHaveProperty('disclose_shortfall_quantity');
  });

  it('PUTs to the counterparty override route, and that body carries no trust_class', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ row: { counterparty_participant_id: COUNTERPARTY, attribute_class_id: 'availability', disclosure: 'declined', disclose_shortfall_quantity: null } }) }));
    render(<DisclosurePolicyClient classes={classes} policy={policy} participation={{ global: true, per_class: {} }} overrides={[]} counterparty={COUNTERPARTY} />);
    fireEvent.change(screen.getByLabelText('availability override disclosure'), { target: { value: 'declined' } });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(`/api/account/disclosure-policy/overrides/${COUNTERPARTY}`, expect.objectContaining({ method: 'PUT' })));
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string);
    expect(body).not.toHaveProperty('trust_class');
  });

  // I1 (review-L7-1, fix round): a rejected save must not be displayed as applied policy.
  // Following the GuardRulesMatrix.save() precedent (guard-rules-matrix.tsx:160): check res.ok,
  // keep the prior state on failure, and show the page's existing inline-alert convention
  // (page.tsx:28 — role="alert", text-problem).
  it('I1: keeps the prior matrix cell and shows an alert when the matrix PUT is rejected', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' }));
    render(<DisclosurePolicyClient classes={classes} policy={policy} participation={{ global: true, per_class: {} }} overrides={[]} counterparty={null} />);
    fireEvent.change(screen.getByLabelText('availability disclosure for trading_pair'), { target: { value: 'raw' } });
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    // Registry default for trading_pair is 'qualified' (the fixture); the rejected write to 'raw' must not stick.
    expect(screen.getByLabelText('availability disclosure for trading_pair')).toHaveValue('qualified');
  });

  it('I1: keeps the prior override state and shows an alert when the override PUT is rejected', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' }));
    render(<DisclosurePolicyClient classes={classes} policy={policy} participation={{ global: true, per_class: {} }} overrides={[]} counterparty={COUNTERPARTY} />);
    fireEvent.change(screen.getByLabelText('availability override disclosure'), { target: { value: 'declined' } });
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    // The row must still read Inherited: the rejected override never took effect.
    expect(screen.getByText('Inherited')).toBeInTheDocument();
  });

  it('I1: keeps the prior participation state and shows an alert when the room-participation PUT is rejected', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' }));
    render(<DisclosurePolicyClient classes={classes} policy={policy} participation={{ global: true, per_class: {} }} overrides={[]} counterparty={null} />);
    fireEvent.click(screen.getByLabelText('Participate in the evaluation room (all classes)'));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByLabelText('Participate in the evaluation room (all classes)')).toBeChecked();
  });

  // Item 12 (final fix wave): putOrFail mirrored the res.ok check but not the confirmed()
  // precedent's try/catch (partners-panel.tsx) — a thrown fetch (offline, DNS) must show the
  // same alert as a rejected save, not escape as an unhandled rejection.
  it('Item 12: shows an alert and keeps the prior cell when the matrix PUT fetch itself throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    render(<DisclosurePolicyClient classes={classes} policy={policy} participation={{ global: true, per_class: {} }} overrides={[]} counterparty={null} />);
    fireEvent.change(screen.getByLabelText('availability disclosure for trading_pair'), { target: { value: 'raw' } });
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByLabelText('availability disclosure for trading_pair')).toHaveValue('qualified');
  });

  // Item 13 (final fix wave): saveCell applied the requested cell verbatim instead of the row
  // haiCore actually stored ({ row }, disclosure-policy.ts:110). The mocked response returns a
  // disclosure DIFFERENT from what was requested (as if the server normalized it) — a value that
  // is neither the fixture's initial 'qualified' nor the requested 'raw', so this can only pass by
  // the response actually being read.
  it('Item 13: applies the row the matrix PUT response returns, not the requested cell', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ row: { attribute_class_id: 'availability', trust_class: 'trading_pair', disclosure: 'declined', disclose_shortfall_quantity: true, source: 'participant' } }) }));
    render(<DisclosurePolicyClient classes={classes} policy={policy} participation={{ global: true, per_class: {} }} overrides={[]} counterparty={null} />);
    fireEvent.change(screen.getByLabelText('availability disclosure for trading_pair'), { target: { value: 'raw' } });
    await waitFor(() => expect(screen.getByLabelText('availability disclosure for trading_pair')).toHaveValue('declined'));
    expect(screen.getByLabelText('availability disclose shortfall quantity for trading_pair')).toBeChecked();
  });

  // Item 13, override half: saveOverride applied the requested body verbatim instead of the row
  // haiCore stored ({ row }, disclosure-policy.ts:134). The response's disclosure ('raw') differs
  // from what was requested ('declined'), so reading the request body instead of the response
  // would show the wrong value.
  it('Item 13: applies the row the override PUT response returns, not the requested body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ row: { counterparty_participant_id: COUNTERPARTY, attribute_class_id: 'availability', disclosure: 'raw', disclose_shortfall_quantity: null } }) }));
    render(<DisclosurePolicyClient classes={classes} policy={policy} participation={{ global: true, per_class: {} }} overrides={[]} counterparty={COUNTERPARTY} />);
    fireEvent.change(screen.getByLabelText('availability override disclosure'), { target: { value: 'declined' } });
    await waitFor(() => expect(screen.getByLabelText('availability override disclosure')).toHaveValue('raw'));
  });
});
