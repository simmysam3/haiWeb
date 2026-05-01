'use client';

import Link from 'next/link';
import useSWR from 'swr';
import type { TrustClass, TrustBypassAffectedCounterparty } from '@haiwave/protocol';
import { Panel } from '@/components';

const TRUST_CLASS_LABEL: Record<TrustClass, string> = {
  unknown: 'Unknown',
  behavioral_only: 'Behavioral-only',
  trading_pair: 'Trading pair',
  premier_partner: 'Premier partner',
};

const fetcher = async (url: string): Promise<{ counterparties: TrustBypassAffectedCounterparty[] }> => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed (${r.status})`);
  return r.json();
};

/**
 * Spec §7.8: per active trust-bypass class, list the counterparties with at
 * least one explicit decline so the operator can see exactly which partners
 * are NOT receiving auto-approval despite the bypass. Each row deep-links
 * into the existing declines list filtered to that counterparty.
 */
export function PreservedDeclinesPanel({ trustClass }: { trustClass: TrustClass }) {
  const { data, isLoading, error } = useSWR(
    `/api/account/sonar/audit/trust-bypass/affected-counterparties?trust_class=${encodeURIComponent(trustClass)}`,
    fetcher,
  );

  if (isLoading) return null;
  if (error) {
    return (
      <Panel className="p-5">
        <h3 className="font-[family-name:var(--font-display)] text-base font-semibold text-navy mb-2">
          Preserved declines — {TRUST_CLASS_LABEL[trustClass]}
        </h3>
        <p className="text-sm text-problem">Could not load preserved declines.</p>
      </Panel>
    );
  }

  const declined = data?.counterparties.filter((c) => c.explicit_decline_count > 0) ?? [];
  if (declined.length === 0) return null;

  return (
    <Panel className="p-5">
      <h3 className="font-[family-name:var(--font-display)] text-base font-semibold text-navy mb-2">
        Preserved declines — {TRUST_CLASS_LABEL[trustClass]}
      </h3>
      <p className="text-sm text-slate mb-3">
        These counterparties are not receiving auto-approval despite the bypass:
      </p>
      <ul className="space-y-1.5">
        {declined.map((c) => (
          <li key={c.counterparty_participant_id} className="text-sm">
            <Link
              className="text-teal hover:text-navy"
              href={`/account/sonar/audit/nominations?counterparty=${c.counterparty_participant_id}`}
            >
              {c.counterparty_display_name} — {c.explicit_decline_count} declines
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
