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
}): string {
  const hash = `Run ${run.run_id.slice(0, 8)}`;
  if (run.template_name) return `${run.template_name} — ${hash}`;
  return hash;
}

// Re-export the existing cadence formatter so the shared module is the
// canonical import path for all observation-surface formatters.
export { formatCadence } from '@/app/account/sonar/templates/_lib/format-cadence';
