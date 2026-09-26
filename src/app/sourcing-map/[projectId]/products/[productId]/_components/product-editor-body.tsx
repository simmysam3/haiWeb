'use client';
import { useState } from 'react';
import type { SmProductDetail } from '@haiwave/protocol';
import { smFetch } from '@/lib/sourcing-map/client';
import { ProductEditor } from './product-editor';
import { BomGrid } from './bom-grid';
import { AgentBomView } from './agent-bom-view';
import { ImportAgentDialog } from './import-agent-dialog';
import { UploadWizard } from '@/app/sourcing-map/_components/upload-wizard/upload-wizard';
import { SmButton } from '../../../../_components/sm-button';

export function ProductEditorBody({ projectName, projectError = null, detail: initialDetail }: {
  projectName: string; projectError?: string | null; detail: SmProductDetail;
}) {
  // LW-b: the product as last saved. Every write reports its answer here, so the header's badge and crumb, the grid
  // and the wizard all read one current product; the page keys this body by product alone and never remounts it.
  const [detail, setDetail] = useState(initialDetail);
  // LW-b: bumped only by a wholesale replacement from outside the grid (an upload commit, an import), it keys the
  // grid's draft. The grid's own save never bumps it: the grid already takes its PUT's answer as its draft.
  const [bomRevision, setBomRevision] = useState(0);
  const [importing, setImporting] = useState(false);
  const [uploading, setUploading] = useState(false);
  // stale-lock: the message of a failed re-read after a successful import. The body's product is then older than the
  // server's, so this is set only there and nothing in the page clears it; only a reload does.
  const [staleRead, setStaleRead] = useState<string | null>(null);
  const locked = staleRead !== null;

  // An import answers only counts (contract: ImportAgentBomResponse), so one read brings the product it made: its
  // lines for a copy, or `bom_source: agent` for a link, which switches the body to the agent view.
  async function rereadAfterImport() {
    const out = await smFetch<SmProductDetail>(`/api/account/sourcing-map/products/${detail.product_id}`);
    if (!out.ok) {
      setStaleRead(out.message);
      return;
    }
    setDetail(out.data);
    setBomRevision((r) => r + 1);
  }

  return (
    <ProductEditor projectName={projectName} projectError={projectError} detail={detail} onSaved={(p) => setDetail((d) => ({ ...d, ...p }))}>
      {locked && (
        <p role="alert" className="sm-error mb-3 text-sm">{`The import succeeded, but the product could not be re-read: ${staleRead} Reload the page to continue.`}</p>
      )}
      {detail.bom_source === 'agent' ? (
        // F-a: only an upload or an import moves the revision, so here a Link import has just switched this body in
        // place, removing the toolbar focus had returned to; the agent view's heading takes it.
        <AgentBomView detail={detail} focusOnMount={bomRevision > 0} />
      ) : (
        <>
          {/* Outside the element the revision key remounts, so the dialogs' focus restore finds its live opener. The
              stale lock makes them aria-disabled, never disabled: the Import dialog hands focus back to its opener as
              the lock lands, and a disabled one would drop it to <body> (LW-a). */}
          <div className="mb-3 flex justify-end gap-2">
            <SmButton className="sm-btn sm-btn-ghost" aria-disabled={locked} onClick={() => setUploading(true)}>Upload BOM</SmButton>
            <SmButton className="sm-btn sm-btn-ghost" aria-disabled={locked} onClick={() => setImporting(true)}>Import from agent</SmButton>
          </div>
          <BomGrid
            key={bomRevision}
            productId={detail.product_id}
            axis={detail.variant_axis}
            initialLines={detail.lines}
            classes={detail.classes}
            onSaved={setDetail}
            locked={locked}
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
