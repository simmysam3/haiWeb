import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InstallationsTable } from '../installations-table';
import type { ProvenanceKeyInstallation, SharingPolicy } from '@haiwave/protocol';

const INST: ProvenanceKeyInstallation = {
  installation_id: 'i1',
  key_id: 'k1',
  installer_participant_id: 'installer-abc',
  accepted_required_fields: ['state_province'],
  accepted_requested_fields: [],
  installed_at: '2026-04-18T00:00:00.000Z',
  updated_at: '2026-04-18T00:00:00.000Z',
  removed_at: null,
  auto_removed_reason: null,
  compliance: { status: 'compliant', missing_fields: [], grace_deadline: null },
};

const POLICY: SharingPolicy = { shared_fields: ['state_province'] };

describe('InstallationsTable', () => {
  it('renders empty state when installations is empty', () => {
    render(
      <InstallationsTable installations={[]} sharingPolicy={POLICY} onRefresh={() => {}} />,
    );
    expect(screen.getByText(/no installations yet/i)).toBeInTheDocument();
  });

  it('renders an Install Key button', () => {
    render(
      <InstallationsTable installations={[]} sharingPolicy={POLICY} onRefresh={() => {}} />,
    );
    expect(screen.getByRole('button', { name: /install key/i })).toBeInTheDocument();
  });

  it('renders a row per installation with compliance chip', () => {
    render(
      <InstallationsTable installations={[INST]} sharingPolicy={POLICY} onRefresh={() => {}} />,
    );
    expect(screen.getByText(/k1/i)).toBeInTheDocument();
    expect(screen.getByText(/compliant/i)).toBeInTheDocument();
  });

  it('opens the installation-details drawer when a row is clicked', async () => {
    render(
      <InstallationsTable installations={[INST]} sharingPolicy={POLICY} onRefresh={() => {}} />,
    );
    const row = screen.getByText(/k1/i).closest('tr');
    if (row) await userEvent.click(row);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
