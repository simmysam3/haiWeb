import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import type { Modality, Posture, TrustClass } from '@haiwave/protocol';

interface UpdatePostureBody {
  posture: Posture;
  signal_type_overrides?: string[] | null;
}

/**
 * PUT /api/account/settings/trust-posture/[trust_class]/[modality] —
 * update one cell of the caller's posture grid. v1.30 PR-3 BFF
 * passthrough; haiCore performs Zod validation on trust_class, modality
 * and posture, so we forward the URL segments as typed casts and let
 * haiCore reject anything malformed with a 4xx (propagated by
 * withHaiCore).
 */
export const PUT = withHaiCore<{ trust_class: string; modality: string }>(
  async ({ client, request, params, session }) => {
    const body = (await request.json().catch(() => ({}))) as UpdatePostureBody;
    return NextResponse.json(
      await client.updateModalityPosture(
        session.participant.id,
        params.trust_class as TrustClass,
        params.modality as Modality,
        body.posture,
        body.signal_type_overrides ?? null,
      ),
    );
  },
);
