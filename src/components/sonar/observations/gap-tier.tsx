'use client';

// Tier 4 is a rollup bucket: every gap at depth_level >= 4 collapses into it.
const MAX_TIER = 4;

export function tierBucket(depthLevel: number): number {
  return Math.min(Math.max(depthLevel, 1), MAX_TIER);
}

export function tierLabel(tier: number): string {
  return tier >= MAX_TIER ? `${MAX_TIER}+` : String(tier);
}

// Follow-up urgency weighting. A shallow gap is far more actionable than a
// deep one — a tier-1 vendor that won't disclose is your problem to chase;
// a tier-4 sub-supplier gap is mostly informational. Weights chosen by the
// product owner: T1=5, T2=3, T3=2, T4+=1 point each.
const TIER_POINTS: Record<number, number> = { 1: 5, 2: 3, 3: 2, 4: 1 };

export function tierPoints(tier: number): number {
  return TIER_POINTS[tier] ?? 1;
}

export function scoreOf(tiers: Map<number, number>): number {
  let pts = 0;
  for (const [tier, count] of tiers) pts += count * tierPoints(tier);
  return pts;
}

export function mergeTiers(into: Map<number, number>, from: Map<number, number>): void {
  for (const [tier, count] of from) into.set(tier, (into.get(tier) ?? 0) + count);
}

// Lowest (shallowest) tier with a gap — drives the severity colour of the
// score pill so the most urgent offenders read hottest.
export function worstTier(tiers: Map<number, number>): number | null {
  let min: number | null = null;
  for (const t of tiers.keys()) min = min === null ? t : Math.min(min, t);
  return min;
}

// Severity shading by tier: tier 1 dominates (problem-red), tier 2 amber,
// tier 3 slate, tier 4+ muted — so the eye lands on the shallowest gaps.
const TIER_STYLE: Record<number, { bg: string; text: string }> = {
  1: { bg: 'bg-[var(--color-problem)]/15', text: 'text-[var(--color-problem)]' },
  2: { bg: 'bg-amber-100', text: 'text-amber-700' },
  3: { bg: 'bg-slate-100', text: 'text-slate-600' },
  4: { bg: 'bg-slate-50', text: 'text-slate-400' },
};

function tierStyle(tier: number): { bg: string; text: string } {
  return TIER_STYLE[tier] ?? TIER_STYLE[MAX_TIER];
}

// Segmented pill: one cell per tier from 1..deepest-gapped tier. Intermediate
// tiers with no gaps render dimmed (the chain is clean at that level) rather
// than dropped, so the depth at which problems appear stays legible. No gaps
// anywhere → an em-dash.
export function GapTierBar({ tiers }: { tiers: Map<number, number> }) {
  if (tiers.size === 0) return <span className="text-slate">—</span>;
  const maxTier = Math.max(...tiers.keys());
  const segments: { tier: number; count: number }[] = [];
  for (let t = 1; t <= maxTier; t++) {
    segments.push({ tier: t, count: tiers.get(t) ?? 0 });
  }
  const title = segments
    .map((s) => `Tier ${tierLabel(s.tier)}: ${s.count}`)
    .join(' · ');
  return (
    <span
      className="inline-flex overflow-hidden rounded border border-slate/15 text-[11px] font-medium"
      title={title}
    >
      {segments.map((s, i) => {
        const dim = s.count === 0;
        const st = tierStyle(s.tier);
        return (
          <span
            key={s.tier}
            className={`px-1.5 py-0.5 tabular-nums ${
              i > 0 ? 'border-l border-slate/15' : ''
            } ${dim ? 'bg-transparent text-slate-300' : `${st.bg} ${st.text}`}`}
            aria-label={`Tier ${tierLabel(s.tier)}: ${s.count}`}
          >
            {s.count}
          </span>
        );
      })}
    </span>
  );
}

export function ScorePill({
  score,
  tiers,
}: {
  score: number;
  tiers: Map<number, number>;
}) {
  if (score === 0) return <span className="text-slate">0</span>;
  const wt = worstTier(tiers);
  const st = wt ? tierStyle(wt) : tierStyle(MAX_TIER);
  return (
    <span
      className={`inline-flex items-baseline gap-0.5 rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums ${st.bg} ${st.text}`}
      title="Follow-up priority — T1×5 + T2×3 + T3×2 + T4+×1"
    >
      {score}
      <span className="text-[10px] font-normal opacity-70">pts</span>
    </span>
  );
}
