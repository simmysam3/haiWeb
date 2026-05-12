'use client';

import { useState } from 'react';
import type { ParticipantModalityPosture, SignalType } from '@haiwave/protocol';
import { Drawer, Button } from '@/components';
import { SIGNAL_TYPE_LABELS } from '@/lib/signal-type-labels';

const MODALITIES = ['audit', 'watcher', 'phantom_demand'] as const;
const TRUST_CLASSES = ['unknown', 'behavioral_only', 'trading_pair', 'premier_partner'] as const;
const POSTURES = ['permissive', 'manual', 'opt_out'] as const;
const WATCHER_SIGNAL_TYPES: readonly SignalType[] = ['lead_time_distribution', 'capacity_utilization_band', 'delivery_event'];

type Modality = (typeof MODALITIES)[number];
type TrustClass = (typeof TRUST_CLASSES)[number];
type Posture = (typeof POSTURES)[number];

interface Props {
  initialPostures: ParticipantModalityPosture[];
}

/**
 * Interactive 3 × 4 posture grid for /account/settings/trust-posture
 * (v1.30 PR-3 Task 6.2). Rows = 3 observation modalities
 * (audit / watcher / phantom_demand). Columns = 4 trust classes
 * (unknown / behavioral_only / trading_pair / premier_partner).
 *
 * Each cell click opens a per-cell drawer; selecting a posture (and, for
 * watcher-permissive, optional signal-type opt-outs) and clicking Save
 * fires a PUT to the BFF route from Task 5.2 and folds the response back
 * into local state.
 */
export function PostureGrid({ initialPostures }: Props) {
  const [postures, setPostures] = useState<ParticipantModalityPosture[]>(initialPostures);
  const [open, setOpen] = useState<{ tc: TrustClass; m: Modality } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function find(tc: TrustClass, m: Modality): ParticipantModalityPosture | undefined {
    return postures.find((p) => p.trust_class === tc && p.modality === m);
  }

  async function save(
    tc: TrustClass,
    m: Modality,
    posture: Posture,
    overrides: string[] | null,
  ): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/account/settings/trust-posture/${tc}/${m}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ posture, signal_type_overrides: overrides }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Save failed (${res.status}): ${text}`);
      }
      const updated = (await res.json()) as ParticipantModalityPosture;
      setPostures((prev) => {
        const next = prev.filter((p) => !(p.trust_class === tc && p.modality === m));
        return [...next, updated];
      });
      setOpen(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6">
      <div role="grid" className="grid grid-cols-5 gap-px bg-slate/15 border border-slate/15 rounded-md overflow-hidden">
        <div className="bg-light-gray p-3 text-xs font-semibold text-charcoal">
          Modality \ Trust Class
        </div>
        {TRUST_CLASSES.map((tc) => (
          <div key={tc} className="bg-light-gray p-3 text-xs font-semibold text-charcoal">
            {TRUST_CLASS_LABEL[tc]}
          </div>
        ))}
        {MODALITIES.map((m) => (
          <PostureRow key={m} m={m} find={find} onCellClick={(tc) => setOpen({ tc, m })} />
        ))}
      </div>

      {error && (
        <p className="mt-3 text-sm text-problem" role="alert">
          {error}
        </p>
      )}

      <Drawer
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open ? `${MODALITY_LABEL[open.m]} / ${TRUST_CLASS_LABEL[open.tc]}` : ''}
      >
        {open && (
          <PostureDrawerBody
            key={`${open.tc}-${open.m}`}
            trustClass={open.tc}
            modality={open.m}
            current={find(open.tc, open.m)}
            saving={saving}
            onSave={(posture, overrides) => save(open.tc, open.m, posture, overrides)}
            onClose={() => setOpen(null)}
          />
        )}
      </Drawer>
    </div>
  );
}

const TRUST_CLASS_LABEL: Record<TrustClass, string> = {
  unknown: 'unknown',
  behavioral_only: 'behavioral_only',
  trading_pair: 'trading_pair',
  premier_partner: 'premier_partner',
};

const MODALITY_LABEL: Record<Modality, string> = {
  audit: 'audit',
  watcher: 'watcher',
  phantom_demand: 'phantom_demand',
};

function PostureRow({
  m,
  find,
  onCellClick,
}: {
  m: Modality;
  find: (tc: TrustClass, m: Modality) => ParticipantModalityPosture | undefined;
  onCellClick: (tc: TrustClass) => void;
}) {
  return (
    <>
      <div className="bg-white p-3 text-sm font-medium text-charcoal">{MODALITY_LABEL[m]}</div>
      {TRUST_CLASSES.map((tc) => {
        const p = find(tc, m);
        const posture = p?.posture ?? 'manual';
        return (
          <button
            key={`${m}-${tc}`}
            type="button"
            role="gridcell"
            aria-label={`${m} posture for ${tc}`}
            className="bg-white p-3 text-left hover:bg-light-gray transition-colors"
            onClick={() => onCellClick(tc)}
          >
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${chipClass(posture)}`}
            >
              {posture}
            </span>
          </button>
        );
      })}
    </>
  );
}

function chipClass(posture: Posture): string {
  if (posture === 'permissive') return 'bg-success/15 text-success';
  if (posture === 'opt_out') return 'bg-problem/15 text-problem';
  return 'bg-light-gray text-slate';
}

function PostureDrawerBody({
  trustClass,
  modality,
  current,
  saving,
  onSave,
  onClose,
}: {
  trustClass: TrustClass;
  modality: Modality;
  current?: ParticipantModalityPosture;
  saving: boolean;
  onSave: (posture: Posture, overrides: string[] | null) => Promise<void> | void;
  onClose: () => void;
}) {
  const [posture, setPosture] = useState<Posture>(current?.posture ?? 'manual');
  const [overrides, setOverrides] = useState<string[]>(current?.signal_type_overrides ?? []);

  const isWatcherPermissive = modality === 'watcher' && posture === 'permissive';

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="text-sm font-semibold text-charcoal mb-2">Posture</legend>
        <div className="space-y-1">
          {POSTURES.map((p) => (
            <label key={p} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="posture"
                value={p}
                checked={posture === p}
                onChange={() => setPosture(p)}
                aria-label={p}
              />
              <span className="text-sm text-charcoal">{p}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {isWatcherPermissive && (
        <fieldset>
          <legend className="text-sm font-semibold text-charcoal mb-2">
            Opt out of signal types
          </legend>
          <p className="text-xs text-slate mb-2">
            Permissive watcher shares all signals by default. Tick any signal you want to
            opt OUT of.
          </p>
          <div className="space-y-1">
            {WATCHER_SIGNAL_TYPES.map((st) => {
              const meta = SIGNAL_TYPE_LABELS[st];
              return (
                <label key={st} className="flex items-center gap-2 cursor-pointer" title={meta.tooltip}>
                  <input
                    type="checkbox"
                    checked={overrides.includes(st)}
                    onChange={() =>
                      setOverrides((prev) =>
                        prev.includes(st) ? prev.filter((x) => x !== st) : [...prev, st],
                      )
                    }
                    aria-label={meta.label}
                  />
                  <span className="text-sm text-charcoal">{meta.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="flex justify-end gap-2 pt-3 border-t border-slate/15">
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={() => onSave(posture, isWatcherPermissive ? overrides : null)}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <p className="sr-only">
        Editing {modality} posture for {trustClass}.
      </p>
    </div>
  );
}
