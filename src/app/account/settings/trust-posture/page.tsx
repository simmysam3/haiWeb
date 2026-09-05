import { fetchBffJson } from '@/lib/server-fetch';
import type { ParticipantModalityPosture, Modality, Posture, TrustClass } from '@haiwave/protocol';
import { PageHeader } from '@/components/page-header';
import { PostureGrid } from './_components/posture-grid';

interface PostureGridResponse {
  postures: ParticipantModalityPosture[];
}

/**
 * Spec §6.2 default postures per modality. Mirrors the server-side
 * `DEFAULT_POSTURE` constant in
 * `apps/core/src/services/participant-modality-posture-service.ts`. If the
 * BFF fetch fails we still need to display *something* — synthesising the
 * 12-row grid from these defaults guarantees the user never sees a stale
 * "all manual" grid where phantom_demand cells silently disagree with the
 * real backend default (permissive). The error banner above the grid makes
 * the failure explicit so users know writes will likely also fail.
 */
const DEFAULT_POSTURE: Record<Modality, Posture> = {
  audit: 'manual',
  watcher: 'manual',
  phantom_demand: 'permissive',
};
const TRUST_CLASSES: TrustClass[] = [
  'unknown',
  'behavioral_only',
  'trading_pair',
  'premier_partner',
];
const MODALITIES: Modality[] = ['audit', 'watcher', 'phantom_demand'];
const DEFAULT_CONFIGURED_BY = '00000000-0000-0000-0000-000000000000';

function synthesizeDefaultGrid(): ParticipantModalityPosture[] {
  const grid: ParticipantModalityPosture[] = [];
  for (const tc of TRUST_CLASSES) {
    for (const m of MODALITIES) {
      grid.push({
        participant_id: DEFAULT_CONFIGURED_BY,
        trust_class: tc,
        modality: m,
        posture: DEFAULT_POSTURE[m],
        signal_type_overrides: null,
        effective_from: new Date(0).toISOString(),
        configured_by: DEFAULT_CONFIGURED_BY,
      });
    }
  }
  return grid;
}

interface LoadResult {
  postures: ParticipantModalityPosture[];
  error: string | null;
}

async function loadPostures(): Promise<LoadResult> {
  // D-62: origin from the configured PORTAL_BASE_URL, never the request's
  // Host header; `fetchBffJson` forwards the cookie and never throws — a
  // network failure is `status: 0`.
  const result = await fetchBffJson<PostureGridResponse>('/api/account/settings/trust-posture');
  if (result.kind === 'error') {
    if (result.status === 0) {
      console.error('[trust-posture] fetch failed', result.message);
      return {
        postures: synthesizeDefaultGrid(),
        error:
          'Unable to reach the trust posture service. Showing spec defaults — saves may fail until the backend is reachable.',
      };
    }
    return {
      postures: synthesizeDefaultGrid(),
      error: `Unable to load trust posture (status ${result.status}). Showing spec defaults — saves may fail until the backend is reachable.`,
    };
  }
  return { postures: result.data.postures ?? [], error: null };
}

/**
 * Server component for /account/settings/trust-posture. Loads the caller's
 * 4 × 3 posture grid (12 rows) on the server via the BFF passthrough so the
 * first paint already has data, then hands it to the client PostureGrid for
 * interactive editing.
 *
 * If the BFF call fails (non-200 or network error), we synthesise the grid
 * from the same `DEFAULT_POSTURE` constants the server uses (spec §6.2) and
 * render a visible error banner above the grid. This avoids the silent
 * "everything is manual" misrender that the previous `return []` path
 * produced — in particular the phantom_demand cells correctly default to
 * `permissive`, matching the real backend behavior.
 *
 * Auth: covered by src/proxy.ts which redirects unauthenticated
 * /account/* requests to /api/auth/login before this component runs.
 */
export default async function TrustPosturePage() {
  const { postures, error } = await loadPostures();

  return (
    <div className="space-y-2">
      <PageHeader
        title="Trust Posture"
        description="Configure how counterparties are treated for each observation modality, by trust class. Changes apply immediately."
      />
      {error && (
        <div
          role="alert"
          className="mt-3 p-3 rounded-md border border-problem/30 bg-problem/10 text-sm text-problem"
        >
          {error}
        </div>
      )}
      <PostureGrid initialPostures={postures} />
    </div>
  );
}
