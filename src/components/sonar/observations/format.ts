// Shared observation-surface formatters. See spec §3.2.

export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 'unknown';
  const diffMs = Date.now() - then;
  const m = Math.floor(diffMs / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function formatRunLabel(run: {
  run_id: string;
  template_name?: string | null;
  run_origin?: string | null;
}): string {
  const hash = `Run ${run.run_id.slice(0, 8)}`;
  if (run.template_name) return `${run.template_name} — ${hash}`;
  // Template-less ad-hoc runs (legacy trigger surface, removed 2026-06-09)
  // have no user-given name — say what the run IS rather than a bare id.
  if (run.run_origin === 'ad_hoc') return `Ad-hoc sweep — ${hash}`;
  return hash;
}

// Re-export the existing cadence formatter so the shared module is the
// canonical import path for all observation-surface formatters.
export { formatCadence } from '@/app/account/sonar/templates/_lib/format-cadence';
