'use client';

import type { WatcherRun, WatcherResult } from '@haiwave/protocol';
import { useMemo } from 'react';

interface Run extends WatcherRun {
  results?: WatcherResult[];
}

interface Props {
  runs: Run[];
}

const PAD = { top: 12, right: 12, bottom: 24, left: 36 };
const WIDTH = 480;
const HEIGHT = 200;
const PALETTE = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0891b2'];

function ltP50(r: WatcherResult): number | null {
  if (r.signal_type !== 'lead_time_distribution' || r.synthesis_mode !== 'direct') return null;
  const payload = r.payload as { percentiles?: { p50?: number } } | null;
  return payload?.percentiles?.p50 ?? null;
}

export function CalibratedLTTrendChart({ runs }: Props) {
  const series = useMemo(() => {
    const byCounterparty = new Map<string, { x: number; y: number }[]>();
    const sortedRuns = [...runs].sort((a, b) =>
      a.triggered_at.localeCompare(b.triggered_at),
    );
    sortedRuns.forEach((run, i) => {
      for (const r of run.results ?? []) {
        if (!r.counterparty_participant_id) continue;
        const v = ltP50(r);
        if (v === null) continue;
        const arr = byCounterparty.get(r.counterparty_participant_id) ?? [];
        arr.push({ x: i, y: v });
        byCounterparty.set(r.counterparty_participant_id, arr);
      }
    });
    return { byCounterparty, runCount: sortedRuns.length };
  }, [runs]);

  if (series.byCounterparty.size === 0) {
    return (
      <p className="text-sm italic text-slate">
        Trend view unavailable — no lead-time direct results in the last runs.
      </p>
    );
  }

  let yMax = 0;
  for (const arr of series.byCounterparty.values()) {
    for (const p of arr) if (p.y > yMax) yMax = p.y;
  }
  yMax = Math.ceil(yMax * 1.1) || 1;

  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const xScale = (xi: number) =>
    PAD.left + (series.runCount <= 1 ? innerW / 2 : (xi / (series.runCount - 1)) * innerW);
  const yScale = (yv: number) => PAD.top + innerH - (yv / yMax) * innerH;

  let colorIdx = 0;
  const polylines: { id: string; points: string; color: string }[] = [];
  for (const [cp, points] of series.byCounterparty) {
    const color = PALETTE[colorIdx++ % PALETTE.length];
    const pStr = points.map((p) => `${xScale(p.x)},${yScale(p.y)}`).join(' ');
    polylines.push({ id: cp, points: pStr, color });
  }

  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      role="img"
      aria-label="Calibrated lead-time trend, p50 per counterparty"
      className="text-xs"
    >
      <line
        x1={PAD.left}
        y1={PAD.top}
        x2={PAD.left}
        y2={HEIGHT - PAD.bottom}
        stroke="#cbd5e1"
      />
      <line
        x1={PAD.left}
        y1={HEIGHT - PAD.bottom}
        x2={WIDTH - PAD.right}
        y2={HEIGHT - PAD.bottom}
        stroke="#cbd5e1"
      />
      <text x={4} y={PAD.top + 4} fill="#64748b">{yMax}d</text>
      <text x={4} y={HEIGHT - PAD.bottom} fill="#64748b">0</text>
      {polylines.map((pl) => (
        <polyline
          key={pl.id}
          points={pl.points}
          fill="none"
          stroke={pl.color}
          strokeWidth={1.5}
        />
      ))}
    </svg>
  );
}
