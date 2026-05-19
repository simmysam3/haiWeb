'use client';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Panel } from '@/components';
import type { CoverageSnapshot } from './coverage-stats-strip';

/**
 * v1.34 P6 — coverage trend (§10.2, §15-Q5 / P6-D1).
 *
 * step-after line + dot markers: coverage % holds flat at each measured
 * snapshot until the next, never an interpolated diagonal between widely
 * spaced points. <2 points → onboarding empty-state (P6-D3).
 */
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
            <Tooltip formatter={(v) => `${v ?? 0}%`} />
            <Line type="stepAfter" dataKey="complete_pct" name="Complete" stroke="var(--color-teal)" strokeWidth={2} dot />
            <Line type="stepAfter" dataKey="partial_pct" name="Partial" stroke="var(--color-orange)" strokeWidth={2} dot />
            <Line type="stepAfter" dataKey="no_traversal_pct" name="No traversal" stroke="var(--color-slate)" strokeWidth={2} dot />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
