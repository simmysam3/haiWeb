import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InstallationDetailsDrawer } from '../installation-details-drawer';
import type { ProvenanceKeyInstallation, SharingPolicy } from '@haiwave/protocol';

const INST: ProvenanceKeyInstallation = {
  installation_id: 'i1',
  key_id: 'k1',
  installer_participant_id: 'installer-abc',
  accepted_required_fields: ['facility_country'],
  accepted_requested_fields: ['facility_name'],
  installed_at: '2026-04-18T00:00:00.000Z',
  updated_at: '2026-04-18T00:00:00.000Z',
  removed_at: null,
  auto_removed_reason: null,
  compliance: { status: 'compliant', missing_fields: [], grace_deadline: null },
};

const POLICY: SharingPolicy = { shared_fields: ['facility_country'] };

describe('InstallationDetailsDrawer', () => {
  it('renders accepted required + requested fields', () => {
    render(
      <InstallationDetailsDrawer
        installation={INST}
        sharingPolicy={POLICY}
        open={true}
        onClose={() => {}}
        onChanged={() => {}}
      />,
    );
    expect(screen.getByText(/facility_country/i)).toBeInTheDocument();
    expect(screen.getByText(/facility_name/i)).toBeInTheDocument();
  });

  it('renders an Uninstall action button', () => {
    render(
      <InstallationDetailsDrawer
        installation={INST}
        sharingPolicy={POLICY}
        open={true}
        onClose={() => {}}
        onChanged={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /uninstall/i })).toBeInTheDocument();
  });
});
