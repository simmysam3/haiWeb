'use client';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { Panel } from '@/components';
import type { CoverageCurrent } from '@haiwave/protocol';

/**
 * v1.34 P6 — coverage trend (§10.2, §15-Q5 / P6-D1).
 *
 * step-after line + dot markers: coverage % holds flat at each measured
 * snapshot until the next, never an interpolated diagonal between widely
 * spaced points. <2 points → onboarding empty-state (P6-D3).
 *
 * NearestDotTooltip reads snapshot_completed_at directly from Recharts'
 * tooltip payload (locale-safe — no toLocaleDateString round-trip). Phase
 * 11 finding #10.
 *
 * v1.41 fix: the X axis plots the numeric snapshot timestamp (`t`) on a
 * continuous time scale, NOT a `toLocaleDateString()` category. The category
 * form collapsed every snapshot from the same calendar day onto ONE band
 * (e.g. 52 snapshots → 1 "5/18/2026" tick), so Recharts could not resolve a
 * hovered dot back to its source row and the tooltip surfaced a mismatched
 * (often zero-pct) datum. A unique numeric x gives every snapshot its own
 * position, so hover → correct row → real percentages.
 */

interface TooltipPayloadEntry {
  payload?: {
    snapshot_completed_at?: string;
    complete_pct?: number;
    partial_pct?: number;
    no_traversal_pct?: number;
  };
}

export function NearestDotTooltip({
  active, payload,
}: { active?: boolean; payload?: TooltipPayloadEntry[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  if (!point?.snapshot_completed_at) return null;
  return (
    <div className="rounded-md border border-slate/30 bg-white p-2 text-xs shadow">
      <p className="mb-1 font-medium text-navy">
        {new Date(point.snapshot_completed_at).toLocaleDateString()}
      </p>
      <p className="text-teal">Complete: {point.complete_pct ?? 0}%</p>
      <p className="text-orange">Partial: {point.partial_pct ?? 0}%</p>
      <p className="text-slate">No traversal: {point.no_traversal_pct ?? 0}%</p>
    </div>
  );
}

export function CoverageTrendChart({ points }: { points: CoverageCurrent[] }) {
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
    t: new Date(p.snapshot_completed_at).getTime(),
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
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(t) => new Date(t).toLocaleDateString()}
              tickLine={false}
              axisLine={false}
              fontSize={12}
            />
            <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} fontSize={12} />
            <Tooltip content={<NearestDotTooltip />} />
            <Line type="stepAfter" dataKey="complete_pct" name="Complete" stroke="var(--color-teal)" strokeWidth={2} dot />
            <Line type="stepAfter" dataKey="partial_pct" name="Partial" stroke="var(--color-orange)" strokeWidth={2} dot />
            <Line type="stepAfter" dataKey="no_traversal_pct" name="No traversal" stroke="var(--color-slate)" strokeWidth={2} dot />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
