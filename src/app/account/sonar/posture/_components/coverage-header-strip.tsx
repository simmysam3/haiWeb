import Link from 'next/link';
import { loadCoverage } from '../../_lib/coverage';
import { formatRelativeAge } from '../../_lib/relative-time';

/**
 * v1.37 Posture slim coverage-context strip — rendered in `posture/layout.tsx`
 * ABOVE the section tabs on every Posture child page so the coverage % the
 * user is acting against stays visible as workflow context. Full coverage
 * surface (stats + trend + Geo/Class/Partners charts) lives at
 * `/sonar/dashboard`; this strip is one row, no charts.
 *
 * Trend delta: when the BFF returns ≥2 snapshots, compute the
 * complete-pct change as (latest - prior). Server-side rounding already
 * landed in coverage_pct fields, so a simple subtraction is correct. The
 * comparator text is cadence-aware ("vs 6d ago" instead of the opaque
 * pre-polish "vs prior snapshot") — cadence isn't fixed, so framing the
 * prior snapshot by age gives the user a concrete reference (v1.37
 * polish item 4).
 *
 * Failure mode: any transport failure renders nothing — this is a context
 * strip, not the canonical coverage surface. The Dashboard page is the
 * surface that surfaces transport-level errors as a banner.
 */
export async function CoverageHeaderStrip() {
  const { current: currentResult, trend: trendResult } = await loadCoverage();

  // Silent fail — the context strip is non-canonical. The Dashboard page
  // owns the user-visible error for the coverage surface itself.
  if (currentResult.kind === 'error') return null;
  const snapshot = currentResult.data.snapshot;
  if (!snapshot) return null;

  // Prior snapshot delta + age when available; null when there's only one
  // snapshot (the strip then shows just the current % with no comparator).
  let delta: number | null = null;
  let priorAge: string | null = null;
  if (trendResult.kind === 'ok' && trendResult.data.points.length >= 2) {
    const points = trendResult.data.points;
    const latest = points[points.length - 1];
    const prior = points[points.length - 2];
    delta = latest.complete_pct - prior.complete_pct;
    priorAge = formatRelativeAge(prior.snapshot_completed_at);
  }

  const arrow = delta === null ? '' : delta > 0 ? '↗' : delta < 0 ? '↘' : '→';
  const deltaSign = delta !== null && delta > 0 ? '+' : '';
  const deltaText =
    delta === null || priorAge === null
      ? null
      : `${arrow} ${deltaSign}${delta}% vs ${priorAge}`;

  return (
    <div
      data-testid="coverage-header-strip"
      className="flex items-center justify-between border-b border-slate/15 bg-slate-50/40 px-6 py-2 text-sm"
    >
      <div className="flex items-baseline gap-3">
        <span className="text-xs uppercase tracking-wide text-slate">Coverage</span>
        <span className="font-semibold text-navy">{snapshot.complete_pct}%</span>
        {deltaText && (
          <span
            className={
              delta === null || delta === 0
                ? 'text-xs text-slate'
                : delta > 0
                ? 'text-xs text-teal'
                : 'text-xs text-orange'
            }
          >
            {deltaText}
          </span>
        )}
        <span className="text-xs text-slate">
          · {snapshot.coverage_complete_products} of {snapshot.coverage_total_products} SKUs covered
        </span>
      </div>
      <Link
        href="/account/sonar/dashboard"
        className="text-xs text-teal hover:underline"
      >
        View full coverage →
      </Link>
    </div>
  );
}
