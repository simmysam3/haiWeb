/**
 * GapsTrendStrip — header context strip on the Gaps mode page.
 *
 * v.1.41 Backlog IA PR-6 (spec
 * `docs/superpowers/specs/2026-05-23-v1_41-backlog-ia-restructure-design.md`).
 *
 * The Gaps page lists hundreds of items; the per-item signal is low.
 * The actionable view is the trend: am I reducing gaps over time? This
 * strip renders the latest gap count + week-over-week delta + a
 * 28-day sparkline so the page opens with direction-at-a-glance instead
 * of a flat list dump.
 *
 * Server component — fetches the trend at request time so the strip
 * arrives in the initial RSC payload. Silent-fail on transport errors
 * (renders the current count only with a muted "trend unavailable"
 * subtext); the canonical gap list below still loads independently.
 */

import { headers, cookies } from 'next/headers';

interface TrendPoint {
  at: string;
  gap_count: number;
}

interface TrendResponse {
  window_days: number;
  current_count: number;
  prior_count: number | null;
  delta: number | null;
  series: TrendPoint[];
}

async function fetchTrend(): Promise<TrendResponse | null> {
  const h = await headers();
  const cookie = (await cookies()).toString();
  const protocol = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('host') ?? 'localhost:3001';
  try {
    const res = await fetch(
      `${protocol}://${host}/api/account/sonar/working-list/gap-count-trend?window=28`,
      { headers: { cookie }, cache: 'no-store' },
    );
    if (!res.ok) return null;
    return (await res.json()) as TrendResponse;
  } catch {
    return null;
  }
}

/**
 * Pick the gap_count from ~N days ago for the "vs last week" framing.
 * Series is ASC-by-date; binary-search isn't necessary at this scale.
 * Returns null if the series has no point old enough.
 */
function findPointAt(series: TrendPoint[], daysAgo: number): TrendPoint | null {
  if (series.length === 0) return null;
  const cutoff = Date.now() - daysAgo * 86_400_000;
  // Find the most recent point that's at-or-before the cutoff.
  let best: TrendPoint | null = null;
  for (const p of series) {
    const t = new Date(p.at).getTime();
    if (t <= cutoff) best = p;
    else break;
  }
  return best;
}

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
}

function Sparkline({ values, width = 120, height = 28 }: SparklineProps) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className="text-teal"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export async function GapsTrendStrip() {
  const trend = await fetchTrend();

  if (!trend) {
    return (
      <div className="mb-4 rounded border border-slate/15 bg-white px-4 py-3 text-xs text-slate">
        Gap-count trend temporarily unavailable.
      </div>
    );
  }

  // Prefer 7-day comparison for the inline delta; fall back to the
  // oldest-in-window point if 7 days back isn't available yet.
  const weekAgoPoint = findPointAt(trend.series, 7);
  const weekDelta =
    weekAgoPoint !== null ? trend.current_count - weekAgoPoint.gap_count : trend.delta;
  const weekFramingLabel = weekAgoPoint !== null ? 'vs last week' : `vs ${trend.window_days}d ago`;

  // Tone: gaps DOWN = good (success), UP = bad (problem), flat/null = slate.
  const deltaToneClass =
    weekDelta === null || weekDelta === 0
      ? 'text-slate'
      : weekDelta < 0
        ? 'text-success'
        : 'text-problem';
  const deltaPrefix = weekDelta === null || weekDelta === 0 ? '' : weekDelta < 0 ? '↓ ' : '↑ ';
  const deltaText =
    weekDelta === null
      ? 'no prior comparison'
      : weekDelta === 0
        ? 'unchanged'
        : `${deltaPrefix}${Math.abs(weekDelta)} ${weekFramingLabel}`;

  return (
    <div className="mb-4 flex items-center justify-between rounded border border-slate/15 bg-white px-4 py-3">
      <div className="flex items-baseline gap-3">
        <span className="text-2xl font-semibold text-navy">
          {trend.current_count.toLocaleString()}
        </span>
        <span className="text-xs text-slate">open gaps</span>
        <span className={`text-xs font-medium ${deltaToneClass}`}>{deltaText}</span>
      </div>
      <Sparkline values={trend.series.map((p) => p.gap_count)} />
    </div>
  );
}
