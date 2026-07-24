'use client';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BomTree, BomNode } from '@haiwave/protocol';
import { evaluateNodeReadiness } from '@haiwave/protocol';
import { Pill } from '@/components/pill';
import { IdChip } from '@/components/id-chip';
import { VerifiedUndisclosedChip } from '@/components/verified-undisclosed-chip';
import { DetailChevron } from '@/components/sonar/observations';

// Unified accordion drill-in for a phantom-demand BOM snapshot (spec
// 2026-07-23). One full-width tree; clicking a row toggles its detail band and
// children inline beneath it. Redaction (aliases, class labels, stripped skus)
// arrives already applied at snapshot build — this component only renders it.

// A row's on-hand stock stance vs. its required quantity. Exported for the
// detail band (Task 10) and tests: full coverage suppresses the readiness pill.
export function stockCoverage(node: BomNode): 'full' | 'partial' | 'none' {
  const onHand = node.on_hand_qty;
  if (onHand === null || onHand <= 0) return 'none';
  if (onHand >= node.qty_required_total) return 'full';
  return 'partial';
}

// A node whose vendor identity is withheld: it has a vendor block but no
// participant id (the snapshot stripped it below the first vendor on the path).
export function isRedacted(node: BomNode): boolean {
  return !!node.vendor_block && !node.vendor_block.vendor_participant_id;
}

type SliverTone = 'red' | 'amber' | 'green' | 'none';

const SLIVER_SEVERITY: Record<SliverTone, number> = { none: 0, green: 1, amber: 2, red: 3 };

const SLIVER_CLASS: Record<Exclude<SliverTone, 'none'>, string> = {
  red: 'bg-red-300/60',
  amber: 'bg-amber-300/60',
  green: 'bg-emerald-300/60',
};

const SLIVER_TITLE: Record<Exclude<SliverTone, 'none'>, string> = {
  red: 'Not ready — a blocked or not-ready line in this branch',
  amber: 'At risk — review this branch',
  green: 'Ready or covered from your on-hand stock',
};

// This node's own sliver tone: walls and not-ready are red, at-risk amber,
// ready or full-stock green, everything else uncoloured.
function nodeOwnTone(node: BomNode, targetDate: string): SliverTone {
  if (node.wall_block) return 'red';
  const verdict = evaluateNodeReadiness(node, targetDate).verdict;
  if (verdict === 'not_ready') return 'red';
  if (verdict === 'at_risk') return 'amber';
  if (verdict === 'ready') return 'green';
  if (stockCoverage(node) === 'full') return 'green';
  return 'none';
}

// Worst (most-severe) tone across this node and its whole subtree — used for a
// COLLAPSED row so a buried wall/not-ready still surfaces without expanding
// (ported from watchers/[id]/tree-view.tsx subtreeWorstTone).
function subtreeWorstTone(node: BomNode, targetDate: string): SliverTone {
  let worst = nodeOwnTone(node, targetDate);
  for (const child of node.subcomponents) {
    const t = subtreeWorstTone(child, targetDate);
    if (SLIVER_SEVERITY[t] > SLIVER_SEVERITY[worst]) worst = t;
  }
  return worst;
}

function attributeSummary(node: BomNode): string {
  return node.attributes
    .slice(0, 2)
    .map((a) => a.value)
    .filter((v) => v.length > 0)
    .join(' · ');
}

function IdentityCell({ node, depth }: { node: BomNode; depth: number }) {
  if (node.wall_block) {
    return (
      <>
        <span className="text-sm text-charcoal">{node.component_label}</span>
        <Pill category="disclosure" value="not_visible" tone="problem">
          not visible
        </Pill>
      </>
    );
  }
  if (depth === 0) {
    return (
      <>
        <span className="font-mono text-sm text-charcoal">{node.component_sku}</span>
        <span className="text-sm text-slate">{node.component_label}</span>
        <Pill category="source" value="your_bom" tone="neutral">
          your BOM
        </Pill>
      </>
    );
  }
  if (isRedacted(node)) {
    const summary = attributeSummary(node);
    return (
      <>
        <span className="text-sm text-charcoal">{node.component_label}</span>
        {summary && <span className="text-xs text-slate">{summary}</span>}
        <VerifiedUndisclosedChip alias={node.vendor_block?.supplier_alias} />
      </>
    );
  }
  if (node.vendor_block?.vendor_participant_id) {
    return (
      <>
        <span className="font-mono text-sm text-charcoal">{node.component_sku}</span>
        <span className="text-sm text-slate">{node.component_label}</span>
        {node.vendor_block.vendor_legal_name && (
          <span className="text-sm font-medium text-charcoal">
            {node.vendor_block.vendor_legal_name}
          </span>
        )}
        <IdChip id={node.vendor_block.vendor_participant_id} />
      </>
    );
  }
  if (node.internal_block) {
    return (
      <>
        <span className="font-mono text-sm text-charcoal">{node.component_sku}</span>
        <span className="text-sm text-slate">{node.component_label}</span>
        <Pill category="source" value="internal_mfg">
          {node.internal_block.standard_lt_days
            ? `internal mfg · ${node.internal_block.standard_lt_days}d`
            : 'internal mfg'}
        </Pill>
      </>
    );
  }
  return (
    <>
      <span className="font-mono text-sm text-charcoal">{node.component_sku}</span>
      <span className="text-sm text-slate">{node.component_label}</span>
    </>
  );
}

function TrailingPills({ node, targetDate }: { node: BomNode; targetDate: string }) {
  const coverage = stockCoverage(node);
  const readiness = evaluateNodeReadiness(node, targetDate);
  const rm = node.vendor_block?.raw_material_status ?? null;
  const showReadiness = coverage !== 'full' && readiness.verdict !== 'not_evaluated';
  return (
    <>
      {coverage === 'full' && (
        <Pill category="stock" value="in_stock" tone="stock">
          ✓ in stock · {node.on_hand_qty}
        </Pill>
      )}
      {coverage === 'partial' && (
        <Pill category="stock" value="partial_stock">
          {node.on_hand_qty} of {node.qty_required_total}
        </Pill>
      )}
      {rm &&
        coverage !== 'full' &&
        (rm.declared_conversion ? (
          <Pill category="stock" value="raw_capacity">
            raw ≈ {Math.floor(rm.on_hand.qty * rm.declared_conversion.units_per_uom).toLocaleString()}{' '}
            units
          </Pill>
        ) : (
          <Pill category="stock" value="raw_on_hand">
            raw on hand
          </Pill>
        ))}
      {showReadiness && <Pill category="readiness" value={readiness.verdict} />}
    </>
  );
}

function qtyText(node: BomNode): string {
  if (stockCoverage(node) === 'partial') {
    return `${node.on_hand_qty} of ${node.qty_required_total} on hand`;
  }
  // Surface the true per-parent multiplier when a component explodes
  // (×3 → 360), else the plain rolled-up total (bom-tree-view precedent).
  return node.qty_per_parent_unit === 1
    ? `${node.qty_required_total}`
    : `×${node.qty_per_parent_unit} → ${node.qty_required_total}`;
}

interface TreeRowProps {
  node: BomNode;
  depth: number;
  lineRef: string;
  targetDate: string;
  expanded: Set<string>;
  onToggle: (lineId: string) => void;
  renderBand?: (node: BomNode, lineRef: string) => ReactNode;
}

function TreeRow({ node, depth, lineRef, targetDate, expanded, onToggle, renderBand }: TreeRowProps) {
  const isExpanded = expanded.has(node.line_id);
  const hasChildren = node.subcomponents.length > 0;
  const tone =
    !isExpanded && hasChildren ? subtreeWorstTone(node, targetDate) : nodeOwnTone(node, targetDate);

  return (
    <>
      {/* NOT a <button>: the row carries real buttons (IdChip) + interactive
          pills, and a button-in-button is invalid HTML that React 19 rejects.
          Per the ARIA tree pattern the treeitem itself is the activatable
          element (AccordionLeafRow precedent). */}
      <div
        role="treeitem"
        aria-level={depth + 1}
        aria-expanded={isExpanded}
        tabIndex={0}
        onClick={() => onToggle(node.line_id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle(node.line_id);
          }
        }}
        className="group relative flex w-full items-center gap-2 rounded py-1 pr-3 text-left text-sm hover:bg-slate-50 cursor-pointer"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {tone !== 'none' && (
          <span
            aria-hidden="true"
            title={SLIVER_TITLE[tone]}
            className={`absolute top-1 bottom-1 w-[3px] rounded-full ${SLIVER_CLASS[tone]}`}
            style={{ left: `${depth * 16}px` }}
          />
        )}
        <DetailChevron expanded={isExpanded} />
        <IdentityCell node={node} depth={depth} />
        <span className="ml-auto whitespace-nowrap text-xs text-slate-400">{qtyText(node)}</span>
        <TrailingPills node={node} targetDate={targetDate} />
      </div>
      {isExpanded && (
        <>
          {renderBand?.(node, lineRef)}
          {node.subcomponents.map((child, i) => (
            <TreeRow
              key={child.line_id}
              node={child}
              depth={depth + 1}
              lineRef={`${lineRef}.${i + 1}`}
              targetDate={targetDate}
              expanded={expanded}
              onToggle={onToggle}
              renderBand={renderBand}
            />
          ))}
        </>
      )}
    </>
  );
}

export function BomAccordionTree({
  tree,
  targetDate,
  renderBand,
}: {
  tree: BomTree;
  targetDate: string;
  renderBand?: (node: BomNode, lineRef: string) => ReactNode;
}) {
  // Root open by default; deeper tiers collapse so a buried wall/not-ready
  // surfaces through the collapsed-parent sliver rollup until expanded.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([tree.line_id]));

  const toggle = (lineId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  };

  return (
    <div role="tree" className="rounded border border-slate-200 bg-white p-2">
      <TreeRow
        node={tree}
        depth={0}
        lineRef="1"
        targetDate={targetDate}
        expanded={expanded}
        onToggle={toggle}
        renderBand={renderBand}
      />
    </div>
  );
}
