import type { RunResumptionState } from '@haiwave/protocol';

interface Props {
  resumptionState: RunResumptionState;
}

/**
 * ResumptionHistoryTable — displays the current resumption state for a
 * throttled run. In v1.29 Phase 1 there is only one row (latest state);
 * per-resumption history is a future-phase concern.
 *
 * v1.29 Phase 1.
 */
export function ResumptionHistoryTable({ resumptionState }: Props) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-charcoal mb-2">
        Resumption status
      </h3>
      <table className="text-xs w-full">
        <thead>
          <tr className="text-left text-slate">
            <th className="font-medium pb-1">Throttled at</th>
            <th className="font-medium pb-1">Next resume</th>
            <th className="font-medium pb-1">Resumption count</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{new Date(resumptionState.throttled_at).toLocaleString()}</td>
            <td>{new Date(resumptionState.next_resume_at).toLocaleString()}</td>
            <td>{resumptionState.resumption_count}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
