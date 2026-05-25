'use client';

// Use a module-level RelativeTimeFormat for locale-stable rendering across
// every row. 'auto' numeric mode emits 'today', 'yesterday', etc., where
// appropriate.
const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const DAY_MS = 86_400_000;

interface Props {
  updatedAt: string;
}

export function ManifestRecencyChip({ updatedAt }: Props) {
  const ts = Date.parse(updatedAt);
  if (Number.isNaN(ts)) return null;
  const diffMs = ts - Date.now();
  const days = Math.round(diffMs / DAY_MS);
  const label =
    Math.abs(days) === 0 ? 'updated today' : `updated ${rtf.format(days, 'day')}`;
  return <span className="text-xs text-slate whitespace-nowrap">{label}</span>;
}
