'use client';

import type { ParticipantModalityPosture } from '@haiwave/protocol';

interface Props {
  initialPostures: ParticipantModalityPosture[];
}

/**
 * Stub PostureGrid for v1.30 PR-3 Task 6.1. Replaced in Task 6.2 with the
 * real 4 trust-classes × 3 modalities grid + edit drawer. Renders a
 * placeholder so the page route is independently buildable until the real
 * component lands.
 */
export function PostureGrid({ initialPostures }: Props) {
  return (
    <div className="mt-6 p-4 border rounded text-sm text-slate">
      Coming soon — {initialPostures.length} posture rows loaded.
    </div>
  );
}
