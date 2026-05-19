'use client';
import { useEffect, useState, useCallback } from 'react';
import { TreeView, type TreeOverlay } from '@/app/account/sonar/compliance/runs/[id]/tree-view';
import type { EvidenceTreeResponse, EvidenceTreeNode } from '@haiwave/protocol';
import { AnnotationDrawer, type AnnotationTarget } from './annotation-drawer';

function buildOverlay(
  roots: EvidenceTreeNode[],
  onAnnotate: TreeOverlay['onAnnotate'],
): TreeOverlay {
  const byNodeKey: TreeOverlay['byNodeKey'] = new Map();
  const walk = (n: EvidenceTreeNode) => {
    const pid = n.payload.kind === 'audit' ? n.payload.product_id : null;
    byNodeKey.set(`${n.participant_id ?? ''}|${pid ?? ''}|${n.depth_level}`, {
      attestations: n.attestations, currentAnnotation: n.current_annotation,
    });
    n.components.forEach(walk);
  };
  roots.forEach(walk);
  return { byNodeKey, onAnnotate };
}

export function EvidenceTreeView({ draftId }: { draftId: string }) {
  const [data, setData] = useState<EvidenceTreeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<AnnotationTarget | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(
        `/api/account/sonar/compliance/evidence/draft/${draftId}/tree`);
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error?.message ?? `tree request failed (${res.status})`);
      }
      setData((await res.json()) as EvidenceTreeResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load tree');
    }
  }, [draftId]);

  useEffect(() => { void load(); }, [load]);

  if (error) return <p className="text-problem text-sm p-4">{error}</p>;
  if (!data) return <p className="text-slate text-sm p-4">Loading tree…</p>;

  const overlay = buildOverlay(data.tree_roots, (t) => setTarget(t));

  return (
    <div className="space-y-3">
      {data.tree_roots.map((root, i) => (
        <TreeView key={i} node={root as never} overlay={overlay} />
      ))}
      {target && (
        <AnnotationDrawer
          draftId={draftId}
          target={target}
          existing={null}
          onClose={() => setTarget(null)}
          onSaved={() => { setTarget(null); void load(); }}
        />
      )}
    </div>
  );
}
