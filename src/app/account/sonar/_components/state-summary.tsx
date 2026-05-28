import type { ComplianceChange } from '@haiwave/protocol';
import { summarizeChange } from '../_lib/summarize-change';

interface Props {
  change: ComplianceChange;
}

/**
 * "Going forward" summary panel for the Event detail page. Sits above the
 * side-by-side prior/current cell JSON (which stays as supporting evidence).
 *
 * Optimized for the reviewer asking "do I approve of what this moved to?" —
 * the new value is bold and prominent; the prior value is muted and only
 * present when it adds context.
 */
export function ChangeStateSummary({ change }: Props) {
  const summary = summarizeChange(change);

  // Defensive: if no fields could be extracted (e.g. an unhandled future
  // change_kind), don't render an empty panel — the JSON below still tells
  // the story.
  if (summary.fields.length === 0 && !summary.consider) return null;

  return (
    <section
      data-testid="change-state-summary"
      className="rounded-lg border border-slate/20 border-l-4 border-l-teal bg-white p-5"
    >
      <h2 className="text-base font-semibold text-navy">Going forward</h2>
      <p className="mt-0.5 text-xs uppercase tracking-wider text-slate/70">
        What the new state became
      </p>

      {summary.fields.length > 0 && (
        <dl className="mt-4 space-y-3">
          {summary.fields.map((field) => (
            <div
              key={field.label}
              className="grid grid-cols-1 items-baseline gap-x-3 gap-y-1 sm:grid-cols-[12rem_1fr]"
            >
              <dt className="text-xs uppercase tracking-wider text-slate">
                {field.label}
              </dt>
              <dd className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-base font-medium text-navy">
                  {field.newValue}
                </span>
                {field.priorValue !== undefined && (
                  <span className="text-xs text-slate/60">was {field.priorValue}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {summary.consider && (
        <div className="mt-5 border-t border-slate/10 pt-4">
          <p className="text-sm">
            <span className="font-medium text-navy">To consider </span>
            <span className="text-slate">— {summary.consider}</span>
          </p>
        </div>
      )}
    </section>
  );
}
