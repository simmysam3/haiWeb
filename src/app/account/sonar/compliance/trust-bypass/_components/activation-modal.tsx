'use client';

import { useEffect, useState } from 'react';
import type {
  TrustClass,
  TrustBypassActivationMode,
  TrustBypassAffectedCounterparty,
} from '@haiwave/protocol';
import { Modal, Button } from '@/components';

interface ActivationResponseBody {
  config: {
    config_id: string;
    trust_class: TrustClass;
    enabled: boolean;
    enabled_at: string | null;
  };
  dissolution: {
    affected_counterparty_ids: string[];
    affected_obligation_ids: string[];
    preserved_decline_ids: string[];
  } | null;
}

interface ActivationModalProps {
  trustClass: TrustClass;
  onClose: () => void;
  /** Called on a successful activation. `preservedDeclines` is the count of
   * declines preserved across the dissolution (always 0 for forward_only). */
  onSuccess: (preservedDeclines: number) => void;
}

const TRUST_CLASS_LABEL: Record<TrustClass, string> = {
  unknown: 'Unknown',
  behavioral_only: 'Behavioral-only',
  trading_pair: 'Trading pair',
  premier_partner: 'Premier partner',
};

/**
 * Activation modal per spec §7.5.
 *
 * 1. On mount, fetches affected counterparties (those with existing settings
 *    in the chosen trust class).
 * 2. Operator picks Forward-only (default) or Retroactive.
 * 3. Retroactive reveals an acknowledgement checkbox; the Activate button
 *    stays disabled until ticked. The protocol-level Zod refine on
 *    TrustBypassActivationRequestSchema is the durable enforcement; this
 *    UX gate exists to prevent mistakes.
 * 4. POST to the activate BFF; on success calls onSuccess(preservedDeclines)
 *    so the parent page can surface a toast like "Activated. N declines preserved".
 */
export function ActivationModal({ trustClass, onClose, onSuccess }: ActivationModalProps) {
  const [counterparties, setCounterparties] = useState<TrustBypassAffectedCounterparty[]>([]);
  const [counterpartiesLoading, setCounterpartiesLoading] = useState(true);
  const [mode, setMode] = useState<TrustBypassActivationMode>('forward_only');
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCounterpartiesLoading(true);
    fetch(
      `/api/account/sonar/audit/trust-bypass/affected-counterparties?trust_class=${encodeURIComponent(trustClass)}`,
    )
      .then(async (r) => {
        if (!r.ok) throw new Error(`Failed to load counterparties (${r.status})`);
        return (await r.json()) as { counterparties: TrustBypassAffectedCounterparty[] };
      })
      .then((d) => {
        if (!cancelled) {
          setCounterparties(d.counterparties);
          setCounterpartiesLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setCounterpartiesLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [trustClass]);

  const canSubmit = !submitting && (mode === 'forward_only' || (mode === 'retroactive' && acknowledged));

  async function submit(): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/account/sonar/audit/trust-bypass/activate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          trust_class: trustClass,
          activation_mode: mode,
          retroactive_acknowledgement: mode === 'retroactive' ? acknowledged : false,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Activation failed (${response.status}): ${text}`);
      }
      const body = (await response.json()) as ActivationResponseBody;
      onSuccess(body.dissolution?.preserved_decline_ids.length ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activation failed');
    } finally {
      setSubmitting(false);
    }
  }

  const totalOutstanding = counterparties.reduce((sum, c) => sum + c.outstanding_obligation_count, 0);
  const totalDeclined = counterparties.reduce((sum, c) => sum + c.explicit_decline_count, 0);

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={`Enable trust bypass — ${TRUST_CLASS_LABEL[trustClass]}`}
      width="max-w-2xl"
    >
      <div className="space-y-5">
        <section>
          <h4 className="text-sm font-semibold text-charcoal mb-2">Affected counterparties</h4>
          {counterpartiesLoading ? (
            <p className="text-sm text-slate">Loading…</p>
          ) : counterparties.length === 0 ? (
            <p className="text-sm text-slate">
              None — no counterparties currently have granular settings in this class.
            </p>
          ) : (
            <ul className="text-sm space-y-1 max-h-48 overflow-y-auto border border-slate/15 rounded-md p-3">
              {counterparties.map((c) => (
                <li key={c.counterparty_participant_id} className="text-charcoal">
                  <span className="font-medium">{c.counterparty_display_name}</span>
                  {' — '}
                  {c.outstanding_obligation_count} outstanding,{' '}
                  {c.explicit_decline_count} declined
                </li>
              ))}
            </ul>
          )}
          {!counterpartiesLoading && counterparties.length > 0 && (
            <p className="text-xs text-slate mt-2">
              Totals: {totalOutstanding} outstanding · {totalDeclined} declined
            </p>
          )}
        </section>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-charcoal mb-2">Activation mode</legend>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="activation-mode"
              value="forward_only"
              checked={mode === 'forward_only'}
              onChange={() => {
                setMode('forward_only');
                setAcknowledged(false);
              }}
              className="mt-1"
            />
            <span className="text-sm text-charcoal">
              <span className="font-medium">Forward-only</span> (default). New nominations
              auto-acknowledge; existing settings preserved.
            </span>
          </label>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="activation-mode"
              value="retroactive"
              checked={mode === 'retroactive'}
              onChange={() => setMode('retroactive')}
              className="mt-1"
            />
            <span className="text-sm text-charcoal">
              <span className="font-medium">Retroactive</span>. Dissolves all prior granular
              settings; existing outstanding obligations auto-acknowledge.
            </span>
          </label>

          {mode === 'retroactive' && (
            <label className="flex items-start gap-2 ml-6 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm text-charcoal">
                I understand all prior granular settings across the listed counterparties
                will be dissolved.
              </span>
            </label>
          )}
        </fieldset>

        <p className="text-xs text-slate bg-light-gray rounded-md p-3">
          Explicit declines remain in place across both activation modes.
        </p>

        {error && (
          <p className="text-sm text-problem" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate/15">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {submitting ? 'Activating…' : 'Activate'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
