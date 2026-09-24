'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SmProductDetail } from '@/lib/sourcing-map/contract';
import { smFetch } from '@/lib/sourcing-map/client';
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
  // LW-b: bumped only by a wholesale replacement from outside the grid (an upload commit, an import), it keys the
  // grid's draft. The grid's own save never bumps it: the grid already takes its PUT's answer as its draft.
  const [bomRevision, setBomRevision] = useState(0);
  const [importing, setImporting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // An import answers only counts (contract: ImportAgentBomResponse), so one read brings the product it made: its
  // lines for a copy, or `bom_source: agent` for a link, which switches the body to the agent view.
  async function rereadAfterImport() {
    const out = await smFetch<SmProductDetail>(`/api/account/sourcing-map/products/${detail.product_id}`);
    if (!out.ok) return;
    setDetail(out.data);
    setBomRevision((r) => r + 1);
  }

  return (
    <ProductEditor projectName={projectName} detail={detail} onSaved={(p) => setDetail((d) => ({ ...d, ...p }))}>
      {detail.bom_source === 'agent' ? (
        <AgentBomView detail={detail} />
      ) : (
        <>
          {/* Outside the element the revision key remounts, so the dialogs' focus restore finds its live opener. */}
          <div className="mb-3 flex justify-end gap-2">
            <button type="button" className="sm-btn sm-btn-ghost" onClick={() => setUploading(true)}>Upload BOM</button>
            <button type="button" className="sm-btn sm-btn-ghost" onClick={() => setImporting(true)}>Import from agent</button>
          </div>
          <BomGrid
            key={bomRevision}
            productId={detail.product_id}
            axis={detail.variant_axis}
            initialLines={detail.lines}
            classes={detail.classes}
            onSaved={(d) => {
              setDetail(d);
              router.refresh();
            }}
          />
        </>
      )}
      {uploading && detail.bom_source === 'workbench' && (
        <UploadWizard
          kind="bom"
          productId={detail.product_id}
          axis={detail.variant_axis}
          onCommitted={(d) => {
            setUploading(false);
            setDetail(d);
            setBomRevision((r) => r + 1);
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
            void rereadAfterImport();
          }}
        />
      )}
    </ProductEditor>
  );
}
