'use client';

import type { ComplianceChangeDetail } from '@haiwave/protocol';
import { Pill } from '@/components/pill';
import { describeChange, kindLabel, severityTone } from '../_lib/describe-change';

interface CellPanelProps {
  label: string;
  samples: Record<string, unknown>[];
  tree: unknown;
}

function CellPanel({ label, samples, tree }: CellPanelProps) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-slate/20 bg-white p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate">{label}</h3>

      <div>
        <p className="mb-2 text-xs font-medium text-navy">Samples</p>
        {samples.length === 0 ? (
          <p className="text-sm text-slate/70">none</p>
        ) : (
          <ul className="space-y-1">
            {samples.map((s, i) => {
              const attrKind = String(s.attribute_kind ?? '—');

              // Resolve displayed value in priority order:
              //   1. value_numeric / value_string (scalar)
              //   2. value_json (structured payload, e.g. certification_status { references: [...] })
              //   3. '—' (genuinely no data)
              // Note: the haiCore cellFor query does NOT project `supported`, so the
              // "agent declined" distinction is not yet available from this route. When
              // haiCore projects `supported`, render s.supported === false as "not supported by vendor".
              const scalarRaw = s.value_numeric ?? s.value_string;
              let val: string;
              if (scalarRaw != null) {
                val = String(scalarRaw);
              } else if (s.value_json != null) {
                val = JSON.stringify(s.value_json as Record<string, unknown>);
              } else {
                val = '—';
              }

              return (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="font-medium text-charcoal">{attrKind}:</span>
                  <span className="text-slate">{val}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-navy">Subtree</p>
        {tree == null ? (
          <p className="text-sm text-slate/70">no subtree</p>
        ) : (
          <pre className="overflow-x-auto rounded border border-slate/10 bg-slate/5 p-3 text-xs text-charcoal">
            {JSON.stringify(tree, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

interface Props {
  detail: ComplianceChangeDetail;
}

export function ChangeDetailCompare({ detail }: Props) {
  const { change, prior_cell, current_cell } = detail;

  return (
    <div className="space-y-6">
      {/* Change summary header */}
      <div className="flex flex-col gap-3 rounded-lg border border-slate/20 bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Pill
            category="change_kind"
            value={change.change_kind}
            tone={severityTone(change.severity)}
          >
            {kindLabel(change.change_kind)}
          </Pill>
          <Pill
            category="severity"
            value={change.severity}
            tone={severityTone(change.severity)}
          />
          <span className="ml-2 text-sm font-medium text-navy">
            {change.vendor_participant_id}
            {change.component_ref ? (
              <span className="ml-1 font-normal text-slate">· {change.component_ref}</span>
            ) : null}
          </span>
          <span className="ml-auto text-xs text-slate/70">
            {new Date(change.detected_at).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </span>
        </div>
        <p data-testid="change-description" className="text-sm text-slate">
          {describeChange(change)}
        </p>
      </div>

      {/* Side-by-side Prior / Current */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <CellPanel label="Prior" samples={prior_cell.samples} tree={prior_cell.tree} />
        <CellPanel label="Current" samples={current_cell.samples} tree={current_cell.tree} />
      </div>
    </div>
  );
}
