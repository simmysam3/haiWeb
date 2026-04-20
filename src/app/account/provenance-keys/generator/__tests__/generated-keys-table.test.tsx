import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GeneratedKeysTable } from '../generated-keys-table';
import type { ProvenanceKeyWithCounts } from '@haiwave/protocol';

const SAMPLE: ProvenanceKeyWithCounts = {
  key_id: 'k1',
  generator_participant_id: 'p1',
  friendly_name: 'USAGOV Audit',
  key_hash: 'a'.repeat(64),
  required_fields: ['facility_country'],
  requested_fields: [],
  purpose: null,
  expires_at: null,
  enabled: true,
  revoked: false,
  revoked_at: null,
  created_at: '2026-04-18T00:00:00.000Z',
  active_installations: 3,
  total_installations: 3,
  active_compliant: 2,
  active_grace_pending: 1,
  active_non_compliant: 0,
};

describe('GeneratedKeysTable', () => {
  it('renders empty state when keys is empty', () => {
    render(<GeneratedKeysTable keys={[]} onRefresh={() => {}} />);
    expect(screen.getByText(/no keys yet/i)).toBeInTheDocument();
  });

  it('renders a row per key with friendly_name and compliance summary', () => {
    render(<GeneratedKeysTable keys={[SAMPLE]} onRefresh={() => {}} />);
    expect(screen.getByText('USAGOV Audit')).toBeInTheDocument();
    expect(screen.getByText(/2 compliant/i)).toBeInTheDocument();
    expect(screen.getByText(/1 grace/i)).toBeInTheDocument();
    expect(screen.getByText(/3.*\/.*3/)).toBeInTheDocument();  // installations ratio
  });

  it('shows "Revoked" status when key.revoked=true', () => {
    render(<GeneratedKeysTable keys={[{ ...SAMPLE, revoked: true }]} onRefresh={() => {}} />);
    expect(screen.getByText(/revoked/i)).toBeInTheDocument();
  });

  it('opens the key-details drawer when a row is clicked', async () => {
    render(<GeneratedKeysTable keys={[SAMPLE]} onRefresh={() => {}} />);
    await userEvent.click(screen.getByText('USAGOV Audit'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
