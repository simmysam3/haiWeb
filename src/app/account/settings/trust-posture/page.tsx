import { cookies, headers } from 'next/headers';
import type { ParticipantModalityPosture } from '@haiwave/protocol';
import { PostureGrid } from './_components/posture-grid';

interface PostureGridResponse {
  postures: ParticipantModalityPosture[];
}

async function loadPostures(): Promise<ParticipantModalityPosture[]> {
  const cookieHeader = (await cookies()).toString();
  const reqHeaders = await headers();
  const host = reqHeaders.get('host') ?? 'localhost:3001';
  const proto = reqHeaders.get('x-forwarded-proto') ?? 'http';
  try {
    const res = await fetch(`${proto}://${host}/api/account/settings/trust-posture`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const payload = (await res.json()) as PostureGridResponse;
    return payload.postures ?? [];
  } catch (err) {
    console.error('[trust-posture] fetch failed', err);
    return [];
  }
}

/**
 * Server component for /account/settings/trust-posture. Loads the caller's
 * 4 × 3 posture grid (12 rows) on the server via the BFF passthrough so the
 * first paint already has data, then hands it to the client PostureGrid for
 * interactive editing.
 *
 * Auth: covered by src/middleware.ts which redirects unauthenticated
 * /account/* requests to /login before this component runs.
 */
export default async function TrustPosturePage() {
  const postures = await loadPostures();

  return (
    <div className="p-6 space-y-2">
      <h1 className="text-xl font-semibold text-charcoal">Trust Posture</h1>
      <p className="text-sm text-slate">
        Configure how counterparties are treated for each observation modality,
        by trust class. Changes apply immediately.
      </p>
      <PostureGrid initialPostures={postures} />
    </div>
  );
}
