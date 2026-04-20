import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditPermissionsModal } from '../edit-permissions-modal';
import type { ProvenanceKeyWithCounts, ProvenanceKeyInstallation } from '@haiwave/protocol';

const KEY: ProvenanceKeyWithCounts = {
  key_id: 'k1',
  generator_participant_id: 'p1',
  friendly_name: 'K',
  key_hash: 'a'.repeat(64),
  required_fields: ['facility_country'],
  requested_fields: [],
  purpose: null,
  expires_at: null,
  enabled: true,
  revoked: false,
  revoked_at: null,
  created_at: '2026-04-18T00:00:00.000Z',
  active_installations: 2,
  total_installations: 2,
  active_compliant: 2,
  active_grace_pending: 0,
  active_non_compliant: 0,
};

function install(id: string, accepted: string[]): ProvenanceKeyInstallation {
  return {
    installation_id: id,
    key_id: 'k1',
    installer_participant_id: `installer-${id}`,
    accepted_required_fields: accepted as never,
    accepted_requested_fields: [],
    installed_at: '2026-04-18T00:00:00.000Z',
    updated_at: '2026-04-18T00:00:00.000Z',
    removed_at: null,
    auto_removed_reason: null,
    compliance: { status: 'compliant', missing_fields: [], grace_deadline: null },
  };
}

describe('EditPermissionsModal', () => {
  it('shows a grace-preview banner when adding a required field that not all installers cover', async () => {
    render(
      <EditPermissionsModal
        keyRow={KEY}
        installations={[install('a', ['facility_country']), install('b', ['facility_country', 'manufacturing_date'])]}
        open={true}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );
    // Toggle manufacturing_date into required
    await userEvent.click(screen.getByLabelText(/manufacturing_date/i));
    expect(screen.getByText(/14-day grace.*1 installation/i)).toBeInTheDocument();
  });
});
