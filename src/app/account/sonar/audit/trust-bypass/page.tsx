'use client';

import { useState } from 'react';
import useSWR from 'swr';
import type { TrustClass, TrustBypassConfig } from '@haiwave/protocol';
import { Button, PageHeader } from '@/components';
import { useToast } from '@/lib/use-toast';
import { ActivationModal } from './_components/activation-modal';
import { PreservedDeclinesPanel } from './_components/preserved-declines-panel';

/**
 * Trust classes the operator can act on. `unknown` and `behavioral_only` are
 * deliberately excluded per spec §7.1: those tiers represent counterparties
 * whose identity has not been independently verified, so auto-acknowledgement
 * is never appropriate.
 */
const ACTIONABLE_TRUST_CLASSES: ReadonlyArray<{ value: TrustClass; label: string; description: string }> = [
  {
    value: 'trading_pair',
    label: 'Trading pair',
    description: 'Counterparties you trade with directly (signed agreement).',
  },
  {
    value: 'premier_partner',
    label: 'Premier partner',
    description: 'Highest trust tier — strategic, long-running partnerships.',
  },
];

const fetcher = async (url: string): Promise<{ configs: TrustBypassConfig[] }> => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed (${r.status})`);
  return r.json();
};

export default function TrustBypassPage() {
  const { data, mutate, isLoading, error } = useSWR(
    '/api/account/sonar/audit/trust-bypass/configs',
    fetcher,
  );
  const [openModalFor, setOpenModalFor] = useState<TrustClass | null>(null);
  const [busyClass, setBusyClass] = useState<TrustClass | null>(null);
  const { toast, showToast } = useToast();

  const configByClass = (cls: TrustClass): TrustBypassConfig | undefined =>
    data?.configs.find((c) => c.trust_class === cls);

  async function handleDisable(cls: TrustClass): Promise<void> {
    if (!confirm('Disable bypass for this trust class? Existing acknowledged obligations remain acknowledged.')) {
      return;
    }
    setBusyClass(cls);
    try {
      const res = await fetch('/api/account/sonar/audit/trust-bypass/deactivate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ trust_class: cls }),
      });
      if (!res.ok && res.status !== 204) {
        const text = await res.text();
        throw new Error(`Deactivate failed (${res.status}): ${text}`);
      }
      showToast('Trust bypass disabled.');
      await mutate();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Deactivate failed');
    } finally {
      setBusyClass(null);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Trust bypass"
        description="Auto-acknowledge inbound nominations from counterparties in selected trust classes. Lower trust classes (unknown / behavioral-only) are never affected. Explicit declines are always preserved."
      />

      {error && (
        <p className="text-sm text-problem" role="alert">
          Could not load trust-bypass configs. Try refreshing the page.
        </p>
      )}

      <div className="rounded-md border border-slate/15 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-light-gray text-charcoal">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Trust class</th>
              <th className="text-left px-4 py-3 font-semibold">State</th>
              <th className="text-left px-4 py-3 font-semibold">Last activated</th>
              <th className="text-right px-4 py-3 font-semibold w-32">Actions</th>
            </tr>
          </thead>
          <tbody>
            {ACTIONABLE_TRUST_CLASSES.map((tc) => {
              const cfg = configByClass(tc.value);
              const enabled = cfg?.enabled ?? false;
              const enabledAt = cfg?.enabled_at;
              return (
                <tr key={tc.value} className="border-t border-slate/15">
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium text-charcoal">{tc.label}</div>
                    <div className="text-xs text-slate mt-0.5">{tc.description}</div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span
                      className={
                        enabled
                          ? 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal/10 text-teal'
                          : 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-light-gray text-slate'
                      }
                    >
                      {enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top text-charcoal">
                    {enabledAt ? new Date(enabledAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 align-top text-right">
                    {enabled ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busyClass === tc.value}
                        onClick={() => handleDisable(tc.value)}
                      >
                        {busyClass === tc.value ? 'Disabling…' : 'Disable'}
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={isLoading}
                        onClick={() => setOpenModalFor(tc.value)}
                      >
                        Enable
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {data?.configs
        .filter((c) => c.enabled)
        .map((c) => <PreservedDeclinesPanel key={c.config_id} trustClass={c.trust_class} />)}

      {openModalFor && (
        <ActivationModal
          trustClass={openModalFor}
          onClose={() => setOpenModalFor(null)}
          onSuccess={(preservedDeclines) => {
            setOpenModalFor(null);
            void mutate();
            showToast(
              preservedDeclines > 0
                ? `Activated. ${preservedDeclines} explicit ${preservedDeclines === 1 ? 'decline' : 'declines'} preserved.`
                : 'Trust bypass activated.',
            );
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-charcoal text-white text-sm rounded-md shadow-lg px-4 py-3 z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
