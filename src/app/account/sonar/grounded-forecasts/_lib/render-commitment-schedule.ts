import type { ForecastClassBlock, GroundedForecastResult } from '@haiwave/protocol';

// v1.62 — the commitment-schedule artifact renderer (spec decision 13). Pure
// text from the stored result document: stored data, never stored prose. The
// golden test in __tests__ pins the FULL output — this string is what the
// vendor pastes into a message to the brand, so every wording or layout change
// is a contract change and must update the golden deliberately.

// Fixed English month names: an unpinned locale would make the artifact drift
// between environments (same reasoning as the list page's pinned en-US digits).
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

const DAY_MS = 86_400_000;

// The agent-side aggregation window (DEFAULT_WINDOW_MONTHS in the MCP stats
// tools). The result document does not echo it, so the assumptions block
// states the standing default.
const OBSERVATION_WINDOW_MONTHS = 24;

/** '2027-01' → 'Jan 2027'. */
export function formatForecastMonth(month: string): string {
  const [y, m] = month.split('-');
  return `${MONTH_NAMES[Number(m) - 1]} ${y}`;
}

function formatQty(qty: number): string {
  return qty.toLocaleString('en-US');
}

function utcMs(dateIso: string): number {
  const [y, m, d] = dateIso.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

// Whole days from the commit date to the prepared-on date. The stored
// past_due flag decides WHETHER a cell is late (run-time truth); the day count
// ages with the artifact, so it is derived from preparedOn at render time.
function daysOverdue(commitDateIso: string, preparedOn: string): number {
  return Math.round((utcMs(preparedOn) - utcMs(commitDateIso)) / DAY_MS);
}

// The evidence clause every class line carries: lead days with the observed
// range, confidence, and the quote — or the observed-only annotation when no
// responder produced a usable quote (spec decision 14: LOW, degraded, loud).
function evidenceClause(block: ForecastClassBlock): string {
  const { observed } = block;
  const observedPart =
    observed.sample_count > 0 && observed.min_days !== null && observed.max_days !== null
      ? `observed ${observed.min_days}–${observed.max_days}`
      : 'no observed history';
  const quotedPart =
    block.quoted_days !== null
      ? `quoted ${block.quoted_days}`
      : 'no current quote — historic basis only';
  const confidence = block.confidence.toUpperCase();
  return `lead ${block.lead_days} days (${observedPart}, ${confidence}; ${quotedPart})`;
}

/**
 * Render the plain-text commitment schedule from a stored forecast result.
 * Pure — no clock reads; `preparedOn` (YYYY-MM-DD) is stamped by the caller.
 *
 * Layout: title block, earliest achievable date, then pacers first in ranking
 * order (each with one line per profile month: commit quantity and date,
 * past-due months flagged with how many days ago the commitment was required),
 * non-pacing classes summarized after, assumptions block last.
 */
export function renderCommitmentSchedule(
  result: GroundedForecastResult,
  preparedOn: string,
): string {
  const rank = new Map(result.pacer_ranking.map((id, i) => [id, i] as const));
  const byRank = (a: ForecastClassBlock, b: ForecastClassBlock) =>
    (rank.get(a.product_class_id) ?? result.pacer_ranking.length) -
    (rank.get(b.product_class_id) ?? result.pacer_ranking.length);
  const pacers = result.classes.filter((c) => c.pacer).sort(byRank);
  const others = result.classes.filter((c) => !c.pacer).sort(byRank);

  const lines: string[] = [];
  lines.push(`COMMITMENT SCHEDULE — ${result.product_name}`);
  lines.push(`Prepared ${preparedOn}`);
  lines.push('');
  lines.push(`Earliest achievable delivery: ${result.earliest_achievable}`);

  for (const block of pacers) {
    lines.push('');
    lines.push(`${block.product_class_id} — PACER · ${evidenceClause(block)}`);
    for (const cell of result.schedule.filter(
      (s) => s.product_class_id === block.product_class_id,
    )) {
      const overdue = cell.past_due
        ? ` — REQUIRED ${daysOverdue(cell.last_commit_date, preparedOn)} DAYS AGO`
        : '';
      lines.push(
        `  ${formatForecastMonth(cell.month)} delivery: commit ${formatQty(cell.quantity)} by ${cell.last_commit_date}${overdue}`,
      );
    }
  }

  if (others.length > 0) {
    lines.push('');
    lines.push('Non-pacing components');
    for (const block of others) {
      lines.push(`  ${block.product_class_id} — ${evidenceClause(block)}`);
    }
  }

  lines.push('');
  lines.push('Assumptions');
  lines.push(`  Final assembly: ${result.assembly_days} days`);
  lines.push(
    `  Monthly quantity: ${formatQty(result.profile.monthly_qty)} units/month, ${result.profile.start_month} through ${result.profile.end_month}`,
  );
  lines.push('  Analogue basis: blended order history of the nominated predecessor SKUs');
  lines.push('  Lead basis: max(quoted days, observed median) per component class');
  lines.push(
    `  Observation window: trailing ${OBSERVATION_WINDOW_MONTHS} months of delivery history`,
  );

  return lines.join('\n');
}
