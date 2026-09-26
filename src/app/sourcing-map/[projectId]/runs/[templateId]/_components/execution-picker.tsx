'use client';
import type { SmExecutionSummary } from '@haiwave/protocol';
import { formatAsOfUtc } from '@/lib/sourcing-map/map/selectors';

/** The header's result picker (spec §9.1): earlier executions can be selected (AC 18). */
export function ExecutionPicker({ executions, selectedId, onSelect }: {
  executions: SmExecutionSummary[]; selectedId: string | null; onSelect(id: string): void;
}) {
  if (executions.length === 0) return null;
  const sorted = [...executions].sort((a, b) => b.created_at.localeCompare(a.created_at));
  // M1: with nothing listed selected, a disabled placeholder is shown (React would otherwise show the newest as
  // chosen, and choosing it would fire no change).
  const value = selectedId !== null && sorted.some((x) => x.execution_id === selectedId) ? selectedId : '';
  return (
    <label className="text-xs">
      <span className="sr-only">Result</span>
      <select aria-label="Result" className="sm-input text-xs" value={value} onChange={(e) => onSelect(e.target.value)}>
        {value === '' && <option value="" disabled>Choose a result</option>}
        {sorted.map((x) => (
          <option key={x.execution_id} value={x.execution_id}>{`${formatAsOfUtc(x.started_at ?? x.created_at)} · ${x.status}`}</option>
        ))}
      </select>
    </label>
  );
}
