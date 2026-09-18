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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    render(<DisclosurePolicyClient classes={classes} policy={policy} participation={{ global: true, per_class: {} }} overrides={[]} counterparty={null} />);
    fireEvent.change(screen.getByLabelText('availability disclosure for trading_pair'), { target: { value: 'raw' } });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/account/disclosure-policy', expect.objectContaining({ method: 'PUT' })));
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string);
    expect(body).toHaveProperty('disclose_shortfall_quantity');
  });

  it('PUTs to the counterparty override route, and that body carries no trust_class', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    render(<DisclosurePolicyClient classes={classes} policy={policy} participation={{ global: true, per_class: {} }} overrides={[]} counterparty={COUNTERPARTY} />);
    fireEvent.change(screen.getByLabelText('availability override disclosure'), { target: { value: 'declined' } });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(`/api/account/disclosure-policy/overrides/${COUNTERPARTY}`, expect.objectContaining({ method: 'PUT' })));
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string);
    expect(body).not.toHaveProperty('trust_class');
  });
});
