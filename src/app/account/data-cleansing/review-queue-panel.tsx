"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/card";
import { Button } from "@/components/button";
import { Modal } from "@/components/modal";
import { DataTable, type Column } from "@/components/data-table";
import { useToast } from "@/lib/use-toast";
import { useApi } from "@/lib/use-api";
import type { ClassificationResult, ConceptNodeSummary } from "@/lib/haiwave-api";

type ActionType = 'reassign' | 'new_node_request' | 'non_product' | 'dismiss';

interface ResultsResponse {
  results: ClassificationResult[];
  total: number;
}

interface TaxonomyResponse {
  nodes: ConceptNodeSummary[];
  total_count: number;
}

export function ReviewQueuePanel() {
  const { toast, showToast } = useToast();
  const [items, setItems] = useState<ClassificationResult[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeAction, setActiveAction] = useState<{ product: ClassificationResult; action: ActionType } | null>(null);
  const [reason, setReason] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string>("");
  const [proposedLabel, setProposedLabel] = useState("");
  const [proposedDesc, setProposedDesc] = useState("");
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

  // Load items once into local state so optimistic removals persist
  useEffect(() => {
    if (loaded) return;
    if (!itemsApi.loading) {
      setItems(itemsApi.data.results);
      setLoaded(true);
    }
  }, [itemsApi.data, itemsApi.loading, loaded]);

  function openAction(product: ClassificationResult, action: ActionType) {
    setActiveAction({ product, action });
    setReason("");
    setSelectedNodeId("");
    setProposedLabel("");
    setProposedDesc("");
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
    if (reason) body.reason = reason;
    if (activeAction.action === 'reassign' && selectedNodeId) {
      body.to_node_ids = [selectedNodeId];
    }
    if (activeAction.action === 'new_node_request') {
      body.proposed_label = proposedLabel;
      body.proposed_desc = proposedDesc;
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
      render: (r) => <span className="font-mono text-sm">{r.product_id}</span>,
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
              Product: <span className="font-mono">{activeAction.product.product_id}</span>
            </div>

            {activeAction.action === 'reassign' && (
              <div>
                <label className="block text-sm font-medium mb-1">Select concept node</label>
                <select
                  value={selectedNodeId}
                  onChange={(e) => setSelectedNodeId(e.target.value)}
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
                    value={proposedLabel}
                    onChange={(e) => setProposedLabel(e.target.value)}
                    className="w-full border border-slate/20 rounded px-3 py-2"
                    placeholder="e.g., Precision Bearings"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={proposedDesc}
                    onChange={(e) => setProposedDesc(e.target.value)}
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
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full border border-slate/20 rounded px-3 py-2"
                placeholder="Why this override?"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={closeAction} disabled={submitting}>Cancel</Button>
              <Button
                onClick={submitAction}
                disabled={submitting || (activeAction.action === 'reassign' && !selectedNodeId) || (activeAction.action === 'new_node_request' && !proposedLabel)}
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

function modalTitle(action: ActionType): string {
  switch (action) {
    case 'reassign': return 'Force-assign to concept node';
    case 'new_node_request': return 'Request new concept node';
    case 'non_product': return 'Mark as non-product';
    case 'dismiss': return 'Dismiss from review queue';
  }
}
