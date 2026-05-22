import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InstallerAcknowledgeModal } from '../installer-acknowledge-modal';
import type { ProvenanceKeyInstallation, SharingPolicy } from '@haiwave/protocol';

const INST: ProvenanceKeyInstallation = {
  installation_id: 'i1',
  key_id: 'k1',
  installer_participant_id: 'p',
  accepted_required_fields: ['state_province'],
  accepted_requested_fields: [],
  installed_at: '2026-04-18T00:00:00.000Z',
  updated_at: '2026-04-18T00:00:00.000Z',
  removed_at: null,
  auto_removed_reason: null,
  compliance: {
    status: 'grace_pending',
    missing_fields: ['plant_identifier'],
    grace_deadline: '2026-05-02T00:00:00.000Z',
  },
};

const POLICY: SharingPolicy = { shared_fields: ['state_province'] };

describe('InstallerAcknowledgeModal', () => {
  it('two-step: calls PUT sharing-policy then PATCH installation', async () => {
    const putPolicy = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ policy: { shared_fields: ['state_province', 'plant_identifier'] }, warnings: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const patchInst = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ installation_id: 'i1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    globalThis.fetch = vi.fn().mockImplementation((url: string | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/sharing-policy')) return putPolicy();
      if (u.includes('/installations/')) return patchInst();
      throw new Error(`unexpected fetch ${u}`);
    }) as unknown as typeof fetch;

    const onAck = vi.fn();
    render(
      <InstallerAcknowledgeModal
        installation={INST}
        sharingPolicy={POLICY}
        open={true}
        onClose={() => {}}
        onAcknowledged={onAck}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /next|review/i }));
    await userEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(putPolicy).toHaveBeenCalledTimes(1);
    expect(patchInst).toHaveBeenCalledTimes(1);
    expect(onAck).toHaveBeenCalled();
  });
});
