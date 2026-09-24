'use client';
import type { SmExecutionSummary } from '@/lib/sourcing-map/contract';
import { formatAsOfUtc } from '@/lib/sourcing-map/map/selectors';

/** The header's result picker (spec §9.1): earlier executions can be selected (AC 18). */
export function ExecutionPicker({ executions, selectedId, onSelect }: {
  executions: SmExecutionSummary[]; selectedId: string | null; onSelect(id: string): void;
}) {
  if (executions.length === 0) return null;
  const sorted = [...executions].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <label className="text-xs">
      <span className="sr-only">Result</span>
      <select aria-label="Result" className="sm-input text-xs" value={selectedId ?? ''} onChange={(e) => onSelect(e.target.value)}>
        {sorted.map((x) => (
          <option key={x.execution_id} value={x.execution_id}>{`${formatAsOfUtc(x.started_at ?? x.created_at)} · ${x.status}`}</option>
        ))}
      </select>
    </label>
  );
}
