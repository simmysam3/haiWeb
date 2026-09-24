'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SmProductDetail } from '@/lib/sourcing-map/contract';
import { ProductEditor } from './product-editor';
import { BomGrid } from './bom-grid';
import { AgentBomView } from './agent-bom-view';
import { ImportAgentDialog } from './import-agent-dialog';
import { UploadWizard } from '@/app/sourcing-map/_components/upload-wizard/upload-wizard';

export function ProductEditorBody({ projectName, detail: initialDetail }: { projectName: string; detail: SmProductDetail }) {
  const router = useRouter();
  // LW-b: the product as last saved. Every write reports its answer here, so the header's badge and crumb, the grid
  // and the wizard all read one current product; the page keys this body by product alone and never remounts it.
  const [detail, setDetail] = useState(initialDetail);
  const [importing, setImporting] = useState(false);
  const [uploading, setUploading] = useState(false);
  return (
    <ProductEditor projectName={projectName} detail={detail} onSaved={(p) => setDetail((d) => ({ ...d, ...p }))}>
      {detail.bom_source === 'agent' ? (
        <AgentBomView detail={detail} />
      ) : (
        <BomGrid
          productId={detail.product_id}
          axis={detail.variant_axis}
          initialLines={detail.lines}
          classes={detail.classes}
          onSaved={(d) => {
            setDetail(d);
            router.refresh();
          }}
          toolbar={
            <>
              <button type="button" className="sm-btn sm-btn-ghost" onClick={() => setUploading(true)}>Upload BOM</button>
              <button type="button" className="sm-btn sm-btn-ghost" onClick={() => setImporting(true)}>Import from agent</button>
            </>
          }
        />
      )}
      {uploading && detail.bom_source === 'workbench' && (
        <UploadWizard
          kind="bom"
          productId={detail.product_id}
          axis={detail.variant_axis}
          onCommitted={() => {
            setUploading(false);
            router.refresh();
          }}
          onClose={() => setUploading(false)}
        />
      )}
      {/* Mounted only while open (the codebase's own precedent: DispositionDialog at runs-tab.tsx, projects-grid.tsx):
          this dialog is otherwise never unmounted, so an earlier open's typed SKU, mode and error would
          otherwise survive Cancel and a reopen. */}
      {importing && (
        <ImportAgentDialog
          productId={detail.product_id}
          open
          onClose={() => setImporting(false)}
          onImported={() => {
            setImporting(false);
            router.refresh();
          }}
        />
      )}
    </ProductEditor>
  );
}
