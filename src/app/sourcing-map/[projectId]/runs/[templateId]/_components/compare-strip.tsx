'use client';
import type { SmCandidateResult2 as SmCandidateResult, SmSlotResult2 as SmSlotResult } from '@/lib/sourcing-map/types';
import { compareColumn, sharedAliases, slotTitle, type CompareColumn } from '@/lib/sourcing-map/map/selectors';

/** The strip's rows, in order, each reading one field of a card's column (§6.7); "Shared sources" spans both columns and follows them. */
const ROWS: Array<[string, keyof CompareColumn]> = [
  ['Coverage', 'coverage'], ['Responders', 'responders'], ['Median', 'median'], ['Modal band', 'modal'], ['Binding source', 'binding'],
];

/** The pinned card set against the active one (LF spec §6.7). */
export function CompareStrip({ pinned, active, asOfDrop, onUnpin }: {
  pinned: { slot: SmSlotResult; candidate: SmCandidateResult }; active: { slot: SmSlotResult; candidate: SmCandidateResult };
  asOfDrop: string | null; onUnpin(): void;
}) {
  const columns = [compareColumn(pinned.slot, pinned.candidate, asOfDrop), compareColumn(active.slot, active.candidate, asOfDrop)];
  // each header adds its slot only when the two cards sit in different slots
  const inSlot = (side: { slot: SmSlotResult }) => (pinned.slot === active.slot ? '' : ` · ${slotTitle(side.slot)}`);
  const shared = sharedAliases(pinned.candidate, active.candidate);
  return (
    <table aria-label="Compare pinned and active" className="sm-table mt-4">
      <thead>
        <tr>
          <td />
          <th scope="col">
            {`${pinned.candidate.supplier_name} (pinned)${inSlot(pinned)}`}
            <button type="button" aria-label={`Unpin ${pinned.candidate.supplier_name}`} className="sm-btn sm-btn-ghost ml-2 text-xs" onClick={onUnpin}>Unpin</button>
          </th>
          <th scope="col">{`${active.candidate.supplier_name}${inSlot(active)}`}</th>
        </tr>
      </thead>
      <tbody>
        {ROWS.map(([label, field]) => (
          <tr key={label}>
            <th scope="row">{label}</th>
            {columns.map((col, i) => <td key={i}>{col[field]}</td>)}
          </tr>
        ))}
        <tr><th scope="row">Shared sources</th><td colSpan={2}>{shared.length > 0 ? shared.join(', ') : 'none'}</td></tr>
      </tbody>
    </table>
  );
}
