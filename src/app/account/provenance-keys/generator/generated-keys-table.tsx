'use client';

import type { ProvenanceKeyWithCounts } from '@haiwave/protocol';

export interface GeneratedKeysTableProps {
  keys: ProvenanceKeyWithCounts[];
  onRefresh: () => void;
}

export function GeneratedKeysTable({ keys }: GeneratedKeysTableProps) {
  if (keys.length === 0) {
    return (
      <p className="text-slate text-sm">
        No keys yet. Click &ldquo;Generate Key&rdquo; to get started.
      </p>
    );
  }
  return <p className="text-slate text-sm">Generator table — implemented in Task 25.</p>;
}
