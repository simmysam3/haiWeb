'use client';

import { useState } from 'react';
import type { ProvenanceKeyWithCounts } from '@haiwave/protocol';
import { KeyDetailsDrawer } from './key-details-drawer';
import { GenerateKeyModal } from './generate-key-modal';

export interface GeneratedKeysTableProps {
  keys: ProvenanceKeyWithCounts[];
  onRefresh: () => void;
}

export function GeneratedKeysTable({ keys, onRefresh }: GeneratedKeysTableProps) {
  const [selected, setSelected] = useState<ProvenanceKeyWithCounts | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-navy">
          Keys you&apos;ve generated
        </h2>
        <button
          type="button"
          className="rounded bg-teal hover:bg-teal-dark text-white px-4 py-2 text-sm font-medium"
          onClick={() => setShowGenerate(true)}
        >
          Generate Key
        </button>
      </div>

      {keys.length === 0 ? (
        <p className="text-slate text-sm">
          No keys yet. Click &ldquo;Generate Key&rdquo; to get started.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate/15 text-left text-slate">
              <th className="py-2 font-medium">Name</th>
              <th className="py-2 font-medium">Compliance</th>
              <th className="py-2 font-medium">Installations</th>
              <th className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr
                key={k.key_id}
                className="border-b border-slate/10 cursor-pointer hover:bg-navy/5"
                onClick={() => setSelected(k)}
              >
                <td className="py-3 text-charcoal">{k.friendly_name}</td>
                <td className="py-3 text-slate">
                  {k.active_compliant} compliant, {k.active_grace_pending} grace, {k.active_non_compliant} non-compliant
                </td>
                <td className="py-3 text-slate">
                  {k.active_installations}/{k.total_installations}
                </td>
                <td className="py-3 text-slate">{k.revoked ? 'Revoked' : 'Active'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selected && (
        <KeyDetailsDrawer
          keyRow={selected}
          open={true}
          onClose={() => {
            setSelected(null);
            onRefresh();
          }}
          onKeyChanged={onRefresh}
        />
      )}

      {showGenerate && (
        <GenerateKeyModal
          open={true}
          onClose={() => setShowGenerate(false)}
          onGenerated={() => {
            setShowGenerate(false);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}
