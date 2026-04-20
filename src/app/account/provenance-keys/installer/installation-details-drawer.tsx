'use client';

import { useState } from 'react';
import { Drawer } from '@/components/drawer';
import { ComplianceChip } from '../_shared/compliance-chip';
import { ConfirmUninstallModal } from './confirm-uninstall-modal';
import { InstallerAcknowledgeModal } from './installer-acknowledge-modal';
import type { ProvenanceKeyInstallation, SharingPolicy } from '@haiwave/protocol';

export interface InstallationDetailsDrawerProps {
  installation: ProvenanceKeyInstallation;
  sharingPolicy: SharingPolicy;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export function InstallationDetailsDrawer({
  installation,
  sharingPolicy,
  open,
  onClose,
  onChanged,
}: InstallationDetailsDrawerProps) {
  const [showUninstall, setShowUninstall] = useState(false);
  const [showAcknowledge, setShowAcknowledge] = useState(false);

  const needsAcknowledge = installation.compliance.status !== 'compliant';

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Installation ${installation.installation_id.slice(0, 8)}\u2026`}
      width="max-w-xl"
    >
      <div className="space-y-6">
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate">
              Compliance
            </h3>
            <ComplianceChip compliance={installation.compliance} />
          </div>
          {installation.compliance.missing_fields.length > 0 && (
            <p className="text-sm text-slate">
              Missing:{' '}
              <span className="font-mono text-xs">
                {installation.compliance.missing_fields.join(', ')}
              </span>
            </p>
          )}
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate mb-2">
            Accepted required fields
          </h3>
          <p className="font-mono text-xs text-charcoal">
            {installation.accepted_required_fields.length > 0
              ? installation.accepted_required_fields.join(', ')
              : '(none)'}
          </p>
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate mb-2">
            Accepted requested fields
          </h3>
          <p className="font-mono text-xs text-charcoal">
            {installation.accepted_requested_fields.length > 0
              ? installation.accepted_requested_fields.join(', ')
              : '(none)'}
          </p>
        </section>

        <div className="flex gap-2">
          {needsAcknowledge && (
            <button
              type="button"
              className="rounded bg-orange hover:opacity-90 text-white px-4 py-2 text-sm font-medium"
              onClick={() => setShowAcknowledge(true)}
            >
              Review &amp; acknowledge
            </button>
          )}
          <button
            type="button"
            className="rounded border border-[#B3261E] text-[#B3261E] hover:bg-[#B3261E]/10 px-4 py-2 text-sm font-medium"
            onClick={() => setShowUninstall(true)}
          >
            Uninstall
          </button>
        </div>
      </div>

      {showUninstall && (
        <ConfirmUninstallModal
          installationId={installation.installation_id}
          open={true}
          onClose={() => setShowUninstall(false)}
          onUninstalled={() => {
            setShowUninstall(false);
            onChanged();
            onClose();
          }}
        />
      )}
      {showAcknowledge && (
        <InstallerAcknowledgeModal
          installation={installation}
          sharingPolicy={sharingPolicy}
          open={true}
          onClose={() => setShowAcknowledge(false)}
          onAcknowledged={() => {
            setShowAcknowledge(false);
            onChanged();
          }}
        />
      )}
    </Drawer>
  );
}
