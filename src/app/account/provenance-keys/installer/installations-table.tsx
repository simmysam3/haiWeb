'use client';

import { useState } from 'react';
import type { ProvenanceKeyInstallation, SharingPolicy } from '@haiwave/protocol';
import { ComplianceChip } from '../_shared/compliance-chip';
import { InstallationDetailsDrawer } from './installation-details-drawer';
import { InstallKeyModal } from './install-key-modal';
import { IdChip } from '@/components/id-chip';

export interface InstallationsTableProps {
  installations: ProvenanceKeyInstallation[];
  sharingPolicy: SharingPolicy;
  onRefresh: () => void;
}

export function InstallationsTable({
  installations,
  sharingPolicy,
  onRefresh,
}: InstallationsTableProps) {
  const [selected, setSelected] = useState<ProvenanceKeyInstallation | null>(null);
  const [showInstall, setShowInstall] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-navy">
          Your installations
        </h2>
        <button
          type="button"
          className="rounded bg-teal hover:bg-teal-dark text-white px-4 py-2 text-sm font-medium"
          onClick={() => setShowInstall(true)}
        >
          Install Key
        </button>
      </div>

      {installations.length === 0 ? (
        <p className="text-slate text-sm">
          No installations yet. Click &ldquo;Install Key&rdquo; and paste a key to get started.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate/15 text-left text-slate">
              <th className="py-2 font-medium">Key</th>
              <th className="py-2 font-medium">Installed</th>
              <th className="py-2 font-medium">Compliance</th>
            </tr>
          </thead>
          <tbody>
            {installations.map((i) => (
              <tr
                key={i.installation_id}
                className="border-b border-slate/10 cursor-pointer hover:bg-navy/5"
                onClick={() => setSelected(i)}
              >
                <td className="py-3"><IdChip id={i.key_id} /></td>
                <td className="py-3 text-slate">
                  {new Date(i.installed_at).toLocaleDateString()}
                </td>
                <td className="py-3">
                  <ComplianceChip compliance={i.compliance} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selected && (
        <InstallationDetailsDrawer
          installation={selected}
          sharingPolicy={sharingPolicy}
          open={true}
          onClose={() => {
            setSelected(null);
            onRefresh();
          }}
          onChanged={onRefresh}
        />
      )}

      {showInstall && (
        <InstallKeyModal
          open={true}
          onClose={() => setShowInstall(false)}
          onInstalled={() => {
            setShowInstall(false);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}
