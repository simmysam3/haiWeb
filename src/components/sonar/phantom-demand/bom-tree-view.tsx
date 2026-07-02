'use client';
import type { BomTree, BomNode } from '@haiwave/protocol';
import { evaluateNodeReadiness } from '@haiwave/protocol';
import { Pill } from '@/components/pill';

interface BomTreeViewProps {
  tree: BomTree;
  selectedLineId: string | null;
  onSelect: (lineId: string) => void;
  targetDate: string;
}

function sourceIcon(node: BomNode): { glyph: string; className: string } {
  if (node.wall_block) return { glyph: '⚠', className: 'text-red-600' };
  switch (node.source) {
    case 'vendor_stock':
      return node.vendor_block?.inventory_disclosure === 'exact' &&
        (node.vendor_block.on_hand_qty_at_vendor ?? 0) >= node.qty_required_total
        ? { glyph: '✓', className: 'text-emerald-600' }
        : { glyph: '⏱', className: 'text-amber-600' };
    case 'vendor_mto':
      return { glyph: '●', className: 'text-sky-600' };
    case 'internal_mfg':
      return { glyph: '⏱', className: 'text-slate-600' };
    default:
      return { glyph: '?', className: 'text-slate-400' };
  }
}

function TreeNode({
  node,
  depth,
  selectedLineId,
  onSelect,
  targetDate,
}: {
  node: BomNode;
  depth: number;
  selectedLineId: string | null;
  onSelect: (lineId: string) => void;
  targetDate: string;
}) {
  const isSelected = node.line_id === selectedLineId;
  const { glyph, className } = sourceIcon(node);
  return (
    <li className="select-none">
      <button
        type="button"
        aria-selected={isSelected}
        onClick={() => onSelect(node.line_id)}
        className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-slate-50 ${
          isSelected ? 'bg-teal-50 font-semibold' : ''
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <span className={`w-4 ${className}`} aria-hidden>
          {glyph}
        </span>
        <span className="font-mono text-slate-900">{node.component_sku}</span>
        <span className="ml-1 text-slate-500">{node.component_label}</span>
        {/* qty column: show the rolled-up total as a plain quantity for 1:1 /
            run-qty nodes, but surface the real per-parent multiplier when a
            component explodes (e.g. 3 ingots per blank → "×3 → 360"). A bare
            "×{total}" here previously read as a multiplier and made an exploded
            component look larger than the run quantity. */}
        <span className="ml-auto whitespace-nowrap text-xs text-slate-400">
          {node.qty_per_parent_unit === 1
            ? node.qty_required_total
            : `×${node.qty_per_parent_unit} → ${node.qty_required_total}`}
        </span>
        {node.alternates_status !== 'not_evaluated' && (
          <span className="ml-2">
            <Pill category="readiness" value={evaluateNodeReadiness(node, targetDate).verdict} />
          </span>
        )}
      </button>
      {node.subcomponents.length > 0 && (
        <ul>
          {node.subcomponents.map((child) => (
            <TreeNode
              key={child.line_id}
              node={child}
              depth={depth + 1}
              selectedLineId={selectedLineId}
              onSelect={onSelect}
              targetDate={targetDate}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function BomTreeView({ tree, selectedLineId, onSelect, targetDate }: BomTreeViewProps) {
  return (
    <ul className="space-y-0.5 rounded border border-slate-200 bg-white p-2" role="tree">
      <TreeNode node={tree} depth={0} selectedLineId={selectedLineId} onSelect={onSelect} targetDate={targetDate} />
    </ul>
  );
}
