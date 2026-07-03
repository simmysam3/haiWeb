import { cookies, headers } from 'next/headers';
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
  const cookieHeader = (await cookies()).toString();
  const reqHeaders = await headers();
  const host = reqHeaders.get('host') ?? 'localhost:3001';
  const proto = reqHeaders.get('x-forwarded-proto') ?? 'http';
  try {
    const res = await fetch(`${proto}://${host}/api/account/settings/trust-posture`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) {
      return {
        postures: synthesizeDefaultGrid(),
        error: `Unable to load trust posture (status ${res.status}). Showing spec defaults — saves may fail until the backend is reachable.`,
      };
    }
    const payload = (await res.json()) as PostureGridResponse;
    return { postures: payload.postures ?? [], error: null };
  } catch (err) {
    console.error('[trust-posture] fetch failed', err);
    return {
      postures: synthesizeDefaultGrid(),
      error:
        'Unable to reach the trust posture service. Showing spec defaults — saves may fail until the backend is reachable.',
    };
  }
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
