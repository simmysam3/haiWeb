'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SmProductDetail } from '@/lib/sourcing-map/contract';
import { ProductEditor } from './product-editor';
import { BomGrid } from './bom-grid';
import { AgentBomView } from './agent-bom-view';
import { ImportAgentDialog } from './import-agent-dialog';

export function ProductEditorBody({ projectName, detail }: { projectName: string; detail: SmProductDetail }) {
  const router = useRouter();
  const [importing, setImporting] = useState(false);
  return (
    <ProductEditor projectName={projectName} detail={detail}>
      {detail.bom_source === 'agent' ? (
        <AgentBomView detail={detail} />
      ) : (
        <BomGrid
          productId={detail.product_id}
          axis={detail.variant_axis}
          initialLines={detail.lines}
          classes={detail.classes}
          onSaved={() => router.refresh()}
          toolbar={<button type="button" className="sm-btn sm-btn-ghost" onClick={() => setImporting(true)}>Import from agent</button>}
        />
      )}
      <ImportAgentDialog
        productId={detail.product_id}
        open={importing}
        onClose={() => setImporting(false)}
        onImported={() => {
          setImporting(false);
          router.refresh();
        }}
      />
    </ProductEditor>
  );
}
