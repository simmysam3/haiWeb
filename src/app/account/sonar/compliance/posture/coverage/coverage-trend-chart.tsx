'use client';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { Panel } from '@/components';
import type { CoverageSnapshot } from './coverage-stats-strip';

/**
 * v1.34 P6 — coverage trend (§10.2, §15-Q5 / P6-D1).
 *
 * step-after line + dot markers: coverage % holds flat at each measured
 * snapshot until the next, never an interpolated diagonal between widely
 * spaced points. <2 points → onboarding empty-state (P6-D3).
 *
 * Tooltip snaps to the nearest data point (NearestDotTooltip) — Recharts'
 * default tooltip surfaces the interpolated value at the hovered X-position
 * along the step-after line, which reads as wrong UX when the user is
 * visually targeting a dot.
 */

/**
 * Find the snapshot whose locale-formatted date is closest to the hovered date label.
 */
export function findNearestPoint(
  points: CoverageSnapshot[],
  hoveredLabel: string
): CoverageSnapshot | null {
  if (points.length === 0) return null;
  const hovered = new Date(hoveredLabel).getTime();
  if (Number.isNaN(hovered)) return points[0];
  let best = points[0];
  let bestDelta = Math.abs(new Date(best.snapshot_completed_at).getTime() - hovered);
  for (const p of points.slice(1)) {
    const delta = Math.abs(new Date(p.snapshot_completed_at).getTime() - hovered);
    if (delta < bestDelta) {
      best = p;
      bestDelta = delta;
    }
  }
  return best;
}

function NearestDotTooltip({
  active, label, points,
}: { active?: boolean; label?: string; points: CoverageSnapshot[] }) {
  if (!active || !label) return null;
  const nearest = findNearestPoint(points, label);
  if (!nearest) return null;
  return (
    <div className="rounded-md border border-slate/30 bg-white p-2 text-xs shadow">
      <p className="mb-1 font-medium text-navy">{new Date(nearest.snapshot_completed_at).toLocaleDateString()}</p>
      <p className="text-teal">Complete: {nearest.complete_pct}%</p>
      <p className="text-orange">Partial: {nearest.partial_pct}%</p>
      <p className="text-slate">No traversal: {nearest.no_traversal_pct}%</p>
    </div>
  );
}

export function CoverageTrendChart({ points }: { points: CoverageSnapshot[] }) {
  if (points.length < 2) {
    return (
      <Panel className="p-4">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-navy mb-3">
          Coverage trend
        </h2>
        <p className="text-sm text-slate text-center py-8">
          Coverage trend appears after your second compliance snapshot. Run
          another compliance audit to start tracking coverage over time.
        </p>
      </Panel>
    );
  }

  const data = points.map((p) => ({
    date: new Date(p.snapshot_completed_at).toLocaleDateString(),
    complete_pct: p.complete_pct,
    partial_pct: p.partial_pct,
    no_traversal_pct: p.no_traversal_pct,
    snapshot_completed_at: p.snapshot_completed_at,
  }));

  return (
    <Panel className="p-4">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-navy mb-3">
        Coverage trend
      </h2>
      <div data-testid="coverage-trend-chart">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-slate)" opacity={0.15} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} fontSize={12} />
            <Tooltip content={<NearestDotTooltip points={points} />} />
            <Line type="stepAfter" dataKey="complete_pct" name="Complete" stroke="var(--color-teal)" strokeWidth={2} dot />
            <Line type="stepAfter" dataKey="partial_pct" name="Partial" stroke="var(--color-orange)" strokeWidth={2} dot />
            <Line type="stepAfter" dataKey="no_traversal_pct" name="No traversal" stroke="var(--color-slate)" strokeWidth={2} dot />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
