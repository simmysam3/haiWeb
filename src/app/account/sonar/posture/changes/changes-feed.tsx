'use client';

import Link from 'next/link';
import type { ComplianceChange } from '@haiwave/protocol';
import { Pill } from '@/components/pill';
import { IdChip } from '@/components/id-chip';
import { describeChange, kindLabel, severityTone } from './_lib/describe-change';

interface Props {
  changes: ComplianceChange[];
  total?: number;
}

export function ChangesFeed({ changes, total }: Props) {
  if (changes.length === 0) {
    return (
      <p className="p-12 text-center text-slate">
        No changes in the selected window.
      </p>
    );
  }

  return (
    <div className="divide-y divide-slate/10">
      {changes.map((change) => {
        const description = describeChange(change);
        const detectedAt = new Date(change.detected_at).toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        });

        return (
          <div key={change.change_id} className="flex items-start justify-between gap-4 px-4 py-4">
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
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
              </div>
              <p className="text-sm font-medium text-navy">
                {change.vendor_legal_name ? (
                  <span title={change.vendor_participant_id}>{change.vendor_legal_name}</span>
                ) : (
                  <IdChip id={change.vendor_participant_id} />
                )}
                {change.component_ref ? (
                  <span className="ml-1 font-normal text-slate">· {change.component_ref}</span>
                ) : null}
              </p>
              <p data-testid="change-description" className="text-sm text-slate">{description}</p>
              <p className="text-xs text-slate/70">{detectedAt}</p>
            </div>
            {/* detail route added in P4 Task 10 */}
            <Link
              href={`/account/sonar/posture/changes/${change.change_id}`}
              className="shrink-0 rounded-md border border-slate/30 px-3 py-1.5 text-xs text-slate hover:border-teal hover:text-navy"
            >
              Compare
            </Link>
          </div>
        );
      })}
      {total !== undefined && changes.length < total && (
        <p className="px-4 py-3 text-xs text-slate/70">
          Showing {changes.length} of {total} — narrow the filters to see more.
        </p>
      )}
    </div>
  );
}
