"use client";

import { useState } from "react";

export interface PricingNode {
  id: string;
  level: string;
  label: string;
  scope?: { product_line?: string; product_id?: string };
  customer_override?: string;
  inherited_from?: string;
  pricing: Record<string, unknown>;
  terms: Record<string, unknown>;
  children?: PricingNode[];
}

interface PricingTreeProps {
  nodes: PricingNode[];
  selectedId: string;
  onSelect: (id: string) => void;
}

const LEVEL_ICONS: Record<string, string> = {
  company: "\u{1F3E2}",      // building
  product_line: "\u{1F4C1}",  // folder
  product: "\u{1F4E6}",       // box
  sku: "\u{1F3F7}",           // tag
  customer_override: "\u{1F464}", // user
};

const LEVEL_LABELS: Record<string, string> = {
  company: "Company",
  product_line: "Product Line",
  product: "Product",
  sku: "SKU",
  customer_override: "Customer Override",
};

function TreeNode({
  node,
  selectedId,
  onSelect,
  depth = 0,
}: {
  node: PricingNode;
  selectedId: string;
  onSelect: (id: string) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = node.id === selectedId;
  const icon = LEVEL_ICONS[node.level] ?? "\u{1F4C4}";

  return (
    <div>
      <button
        onClick={() => onSelect(node.id)}
        className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors rounded-lg ${
          isSelected
            ? "bg-teal/10 text-navy border-l-2 border-teal font-medium"
            : "text-charcoal hover:bg-light-gray"
        }`}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="text-slate hover:text-charcoal text-xs w-4 shrink-0"
          >
            {expanded ? "\u25BC" : "\u25B6"}
          </button>
        )}
        {!hasChildren && <span className="w-4 shrink-0" />}
        <span className="shrink-0">{icon}</span>
        <span className="truncate">{node.label}</span>
      </button>
      {hasChildren && expanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function PricingTree({ nodes, selectedId, onSelect }: PricingTreeProps) {
  return (
    <div className="space-y-0.5">
      <div className="px-3 py-2 mb-2">
        <p className="text-xs font-medium uppercase tracking-wider text-slate">
          Pricing Hierarchy
        </p>
      </div>
      {nodes.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
      <div className="px-3 pt-4">
        <p className="text-xs text-slate leading-relaxed">
          Select a level to view or override pricing. Child levels inherit from their parent unless overridden.
        </p>
      </div>
      <div className="px-3 pt-3">
        <div className="space-y-1.5 text-xs text-slate">
          {Object.entries(LEVEL_ICONS).map(([key, icon]) => (
            <div key={key} className="flex items-center gap-2">
              <span>{icon}</span>
              <span>{LEVEL_LABELS[key] ?? key}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
