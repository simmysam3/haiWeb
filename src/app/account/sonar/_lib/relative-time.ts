/**
 * v1.37 polish — relative-time formatter for snapshot comparisons.
 *
 * Used by the Posture coverage-header strip to render "vs 6d ago" instead
 * of the cadence-opaque "vs prior snapshot". Cadence isn't fixed (could be
 * 1d, 7d, ad-hoc), so framing the comparator by the prior snapshot's age
 * gives the user a concrete reference.
 *
 * Buckets:
 *   - < 24h  → "today"
 *   - < 48h  → "yesterday"
 *   - < 30d  → "Nd ago"
 *   - < 365d → "Nmo ago"
 *   - else   → "Nyr ago"
 *
 * Always rounds DOWN to the relevant unit so "6 days, 12 hours" reads as
 * "6d ago" rather than "7d ago".
 */
export function formatRelativeAge(
  priorIso: string,
  nowMs: number = Date.now(),
): string {
  const priorMs = new Date(priorIso).getTime();
  if (!Number.isFinite(priorMs)) return "earlier";
  const deltaMs = Math.max(0, nowMs - priorMs);
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * oneHour;

  if (deltaMs < oneDay) return "today";
  if (deltaMs < 2 * oneDay) return "yesterday";

  const days = Math.floor(deltaMs / oneDay);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(days / 365);
  return `${years}yr ago`;
}
