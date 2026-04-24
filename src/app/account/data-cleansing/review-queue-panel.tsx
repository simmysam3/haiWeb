"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/card";
import { Button } from "@/components/button";
import { Modal } from "@/components/modal";
import { DataTable, type Column } from "@/components/data-table";
import { IdChip } from "@/components/id-chip";
import { useToast } from "@/lib/use-toast";
import { useApi } from "@/lib/use-api";
import type {
  ClassificationResult,
  ClassificationOverrideAction,
  ConceptNodeSummary,
} from "@/lib/haiwave-api";

interface ResultsResponse {
  results: ClassificationResult[];
  total: number;
}

interface TaxonomyResponse {
  nodes: ConceptNodeSummary[];
  total_count: number;
}

interface ActionForm {
  reason: string;
  selectedNodeId: string;
  proposedLabel: string;
  proposedDesc: string;
}

const EMPTY_FORM: ActionForm = {
  reason: "",
  selectedNodeId: "",
  proposedLabel: "",
  proposedDesc: "",
};

export function ReviewQueuePanel() {
  const { toast, showToast } = useToast();
  const [items, setItems] = useState<ClassificationResult[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeAction, setActiveAction] = useState<{ product: ClassificationResult; action: ClassificationOverrideAction } | null>(null);
  const [form, setForm] = useState<ActionForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const itemsApi = useApi<ResultsResponse>({
    url: '/api/account/data-cleansing',
    fallback: { results: [], total: 0 },
    enabled: !loaded,
  });
  const taxonomyApi = useApi<TaxonomyResponse>({
    url: '/api/account/data-cleansing/taxonomy',
    fallback: { nodes: [], total_count: 0 },
  });

  // Copy API data into local state once the initial fetch completes so that
  // optimistic removals after each action survive without a refetch.
  useEffect(() => {
    if (!loaded && !itemsApi.loading) {
      setItems(itemsApi.data.results);
      setLoaded(true);
    }
  }, [itemsApi.loading, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  function openAction(product: ClassificationResult, action: ClassificationOverrideAction) {
    setActiveAction({ product, action });
    setForm(EMPTY_FORM);
  }

  function closeAction() {
    setActiveAction(null);
  }

  async function submitAction() {
    if (!activeAction) return;
    setSubmitting(true);

    const body: Record<string, unknown> = {
      product_id: activeAction.product.product_id,
      action: activeAction.action,
    };
    if (form.reason) body.reason = form.reason;
    if (activeAction.action === 'reassign' && form.selectedNodeId) {
      body.to_node_ids = [form.selectedNodeId];
    }
    if (activeAction.action === 'new_node_request') {
      body.proposed_label = form.proposedLabel;
      body.proposed_desc = form.proposedDesc;
    }

    try {
      const res = await fetch('/api/account/data-cleansing/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems((prev) => prev.filter((i) => i.product_id !== activeAction.product.product_id));
      showToast(`Action applied to ${activeAction.product.product_id}`);
      closeAction();
    } catch (err) {
      showToast(`Failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  }

  const columns: Column<ClassificationResult>[] = [
    {
      key: 'product_id',
      label: 'Product ID',
      render: (r) => <IdChip id={r.product_id} className="text-sm" />,
    },
    {
      key: 'unclassifiable_reason',
      label: 'Reason',
      render: (r) => r.unclassifiable_reason ?? '—',
    },
    {
      key: 'classified_at',
      label: 'Classified',
      render: (r) => new Date(r.classified_at).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (r) => (
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={() => openAction(r, 'reassign')}>Force-assign</Button>
          <Button size="sm" variant="secondary" onClick={() => openAction(r, 'new_node_request')}>New node</Button>
          <Button size="sm" variant="secondary" onClick={() => openAction(r, 'non_product')}>Not a product</Button>
          <Button size="sm" variant="ghost" onClick={() => openAction(r, 'dismiss')}>Dismiss</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-navy text-white px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      <Card>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-navy">
            Unclassifiable Products ({items.length})
          </h2>
        </div>

        <DataTable
          columns={columns}
          data={items}
          keyFn={(r) => r.product_id}
          emptyMessage="No unclassifiable products — all products have been classified successfully."
        />
      </Card>

      <Modal open={activeAction !== null} onClose={closeAction} title={activeAction ? modalTitle(activeAction.action) : ''}>
        {activeAction && (
          <div className="space-y-4">
            <div className="text-sm text-slate">
              Product: <IdChip id={activeAction.product.product_id} />
            </div>

            {activeAction.action === 'reassign' && (
              <div>
                <label className="block text-sm font-medium mb-1">Select concept node</label>
                <select
                  value={form.selectedNodeId}
                  onChange={(e) => setForm((f) => ({ ...f, selectedNodeId: e.target.value }))}
                  className="w-full border border-slate/20 rounded px-3 py-2"
                >
                  <option value="">-- choose --</option>
                  {taxonomyApi.data.nodes.map((n) => (
                    <option key={n.node_id} value={n.node_id}>{n.master_label}</option>
                  ))}
                </select>
              </div>
            )}

            {activeAction.action === 'new_node_request' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">Proposed label</label>
                  <input
                    type="text"
                    value={form.proposedLabel}
                    onChange={(e) => setForm((f) => ({ ...f, proposedLabel: e.target.value }))}
                    className="w-full border border-slate/20 rounded px-3 py-2"
                    placeholder="e.g., Precision Bearings"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={form.proposedDesc}
                    onChange={(e) => setForm((f) => ({ ...f, proposedDesc: e.target.value }))}
                    rows={3}
                    className="w-full border border-slate/20 rounded px-3 py-2"
                    placeholder="What kind of products belong in this node?"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Reason (optional)</label>
              <input
                type="text"
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                className="w-full border border-slate/20 rounded px-3 py-2"
                placeholder="Why this override?"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={closeAction} disabled={submitting}>Cancel</Button>
              <Button
                onClick={submitAction}
                disabled={submitting || (activeAction.action === 'reassign' && !form.selectedNodeId) || (activeAction.action === 'new_node_request' && !form.proposedLabel)}
              >
                {submitting ? 'Applying…' : 'Apply'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function modalTitle(action: ClassificationOverrideAction): string {
  switch (action) {
    case 'reassign': return 'Force-assign to concept node';
    case 'new_node_request': return 'Request new concept node';
    case 'non_product': return 'Mark as non-product';
    case 'dismiss': return 'Dismiss from review queue';
  }
}
