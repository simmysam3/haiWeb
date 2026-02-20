"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/card";
import { Button } from "@/components/button";
import { PricingTree, PricingNode } from "@/components/pricing-tree";
import { PricingLevelEditor } from "@/components/pricing-level-editor";
import { useApi } from "@/lib/use-api";
import { MOCK_PRICING_HIERARCHY, MockPricingNode } from "@/lib/mock-data";

function convertMockNodes(nodes: MockPricingNode[]): PricingNode[] {
  return nodes.map((n) => ({
    id: n.id,
    level: n.level,
    label: n.label,
    scope: n.scope,
    customer_override: n.customer_override,
    inherited_from: n.inherited_from,
    pricing: n.pricing,
    terms: n.terms,
    children: n.children ? convertMockNodes(n.children) : [],
  }));
}

function findNode(nodes: PricingNode[], id: string): PricingNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

function flattenIds(nodes: PricingNode[]): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    ids.push(node.id);
    if (node.children) {
      ids.push(...flattenIds(node.children));
    }
  }
  return ids;
}

function updateNodeInTree(nodes: PricingNode[], id: string, updater: (n: PricingNode) => PricingNode): PricingNode[] {
  return nodes.map((node) => {
    if (node.id === id) return updater(node);
    if (node.children) {
      return { ...node, children: updateNodeInTree(node.children, id, updater) };
    }
    return node;
  });
}

export default function PricingPage() {
  const [hierarchy, setHierarchy] = useState<PricingNode[]>(() =>
    convertMockNodes(MOCK_PRICING_HIERARCHY),
  );
  const [selectedId, setSelectedId] = useState("");
  const [toast, setToast] = useState("");

  const pricingApi = useApi<MockPricingNode[]>({
    url: "/api/account/pricing",
    fallback: MOCK_PRICING_HIERARCHY,
  });

  useEffect(() => {
    if (!pricingApi.loading) {
      const converted = convertMockNodes(pricingApi.data);
      setHierarchy(converted);
      // Auto-select first node if nothing selected
      if (!selectedId && converted.length > 0) {
        setSelectedId(converted[0].id);
      }
    }
  }, [pricingApi.data, pricingApi.loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select first node on mount
  useEffect(() => {
    if (!selectedId && hierarchy.length > 0) {
      setSelectedId(hierarchy[0].id);
    }
  }, [hierarchy, selectedId]);

  const selectedNode = selectedId ? findNode(hierarchy, selectedId) : null;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  const handleSave = useCallback(async (data: Record<string, unknown>) => {
    // Optimistic update
    setHierarchy((prev) =>
      updateNodeInTree(prev, data.id as string, (node) => ({
        ...node,
        pricing: { ...node.pricing, ...(data.pricing as Record<string, unknown>) },
        terms: { ...node.terms, ...(data.terms as Record<string, unknown>) },
      })),
    );

    // Persist to BFF
    try {
      await fetch("/api/account/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch {
      // Fire-and-forget
    }

    showToast(`Saved pricing for "${(data.label as string) ?? "level"}"`);
  }, []);

  const handleReset = useCallback(async () => {
    if (!selectedNode) return;

    // Optimistic: reset node pricing/terms to empty (will inherit)
    setHierarchy((prev) =>
      updateNodeInTree(prev, selectedNode.id, (node) => ({
        ...node,
        pricing: {},
        terms: {},
      })),
    );

    // Persist deletion to BFF
    try {
      await fetch(`/api/account/pricing?manifest_id=${encodeURIComponent(selectedNode.id)}`, {
        method: "DELETE",
      });
    } catch {
      // Fire-and-forget
    }

    showToast(`Reset "${selectedNode.label}" to inherited values`);
  }, [selectedNode]);

  const allIds = flattenIds(hierarchy);
  const nodeCount = allIds.length;

  return (
    <div>
      <PageHeader
        title="Pricing Hierarchy"
        description="Configure pricing at each level. Child levels inherit from their parent unless overridden."
        actions={
          <Button variant="secondary" size="sm" onClick={pricingApi.refetch}>
            Refresh
          </Button>
        }
      />

      {toast && (
        <div className="bg-success/5 border border-success/20 rounded-lg px-4 py-3 text-sm text-success mb-4">
          {toast}
        </div>
      )}

      {pricingApi.loading ? (
        <Card>
          <div className="text-center py-12 text-sm text-slate">
            Loading pricing hierarchy...
          </div>
        </Card>
      ) : hierarchy.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <div className="text-4xl mb-3 opacity-40">{"\u{1F4B0}"}</div>
            <p className="text-sm text-slate mb-1">No pricing hierarchy configured</p>
            <p className="text-xs text-slate/70">
              Your pricing manifest will appear here once configured.
            </p>
          </div>
        </Card>
      ) : (
        <div className="flex gap-6">
          {/* Left Panel: Tree Navigation */}
          <div className="w-64 shrink-0">
            <div className="bg-white rounded-lg border border-slate/15 py-3">
              <PricingTree
                nodes={hierarchy}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>
            <p className="text-xs text-slate mt-3 px-1">
              {nodeCount} level{nodeCount !== 1 ? "s" : ""} configured
            </p>
          </div>

          {/* Right Panel: Level Editor */}
          <div className="flex-1 min-w-0">
            {selectedNode ? (
              <PricingLevelEditor
                node={selectedNode}
                onSave={handleSave}
                onReset={handleReset}
              />
            ) : (
              <Card>
                <div className="text-center py-12">
                  <p className="text-sm text-slate">
                    Select a level from the tree to view or edit pricing.
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
