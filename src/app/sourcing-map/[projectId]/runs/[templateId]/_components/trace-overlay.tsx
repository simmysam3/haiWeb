'use client';
import { useId, useLayoutEffect } from 'react';
import type { SmTrace } from '@/lib/sourcing-map/types';
import { bandVar, bandWord, gapStubText, traceSentence } from '@/lib/sourcing-map/map/selectors';

/** An anchor in the canvas's frame; a DOMRect satisfies it. */
export interface AnchorRect { x: number; y: number; width: number; height: number }

/** The trace's draw time, recorded as sm-map-render is (map-canvas.tsx:17-43): a mark in render, a measure at commit. */
export const TRACE_MEASURE = 'sm-trace-draw';
const TRACE_START = 'sm-trace-draw:start';
/** How far left of the parent the line runs, in the 16 px gap between cards (MAP_L.gap) or the lane gutter. */
const GUTTER = 10;
const STUB = 14;
/** A gap label: 11 px text on one 16 px line, 4 px below its anchor, the baseline 12 px into the line. */
const LABEL = { font: 11, line: 16, below: 4, baseline: 12, pad: 2 } as const;
/**
 * The label copy's advance per character at 11 px in the map's font: chromium measured the seven copies at 5.27–5.70
 * px a character, the longest ("not observed below: not connected", 33 characters) at 185.5 px (Task 13 harness).
 * The label is drawn at exactly this width (SVG textLength), so the back that keeps it legible over the card's own
 * lines needs no measuring, whatever font the browser ends up with.
 */
const LABEL_CHAR_W = 5.6;

/** From the parent's left-mid, out into the gutter, down to the child's mid-line, into the child's left edge. */
export function tracePath(a: AnchorRect, b: AnchorRect): string {
  const sx = a.x;
  const sy = a.y + a.height / 2;
  const ex = b.x;
  const ey = b.y + b.height / 2;
  const gx = Math.min(sx, ex) - GUTTER;
  return `M${sx} ${sy} L ${gx} ${sy} L ${gx} ${ey} L ${ex} ${ey}`;
}

/** A gap's stub, its label (text-anchor end at x) and the label's back, in the frame's coordinates. */
export interface GapPlacement {
  stub: string;
  text: { x: number; y: number; width: number };
  back: { x: number; y: number; width: number; height: number };
}

/**
 * A gap's stub and label (spec §12.3, Task 13 R3). The stub leaves the anchor's right-mid into the gap beside the card;
 * the label sits inside the traced card, on the line below the anchor, right-aligned to the card's content edge, over
 * a card-coloured back. Beside the stub it painted over the next card (the gap is 16 px), and near the canvas's right
 * edge the svg clipped it. Right-aligned to the card, never to a handle, a label cannot spill left out of the card
 * either (the longest copy is 185 px; a card's content is 210 px). With no card measured, the anchor's own edge.
 * `stack` moves the label that many label lines lower; gapLabels decides it, so that no two labels share a box.
 */
export function gapPlacement(anchor: AnchorRect, card: AnchorRect | undefined, label: string, stack = 0): GapPlacement {
  const sx = anchor.x + anchor.width;
  const sy = anchor.y + anchor.height / 2;
  const right = card ? card.x + card.width : sx;
  const top = anchor.y + anchor.height + LABEL.below + stack * LABEL.line;
  const width = Math.round(label.length * LABEL_CHAR_W);
  return {
    stub: `M${sx} ${sy} L ${sx + STUB} ${sy}`,
    text: { x: right, y: top + LABEL.baseline, width },
    back: { x: right - width - LABEL.pad, y: top, width: width + LABEL.pad, height: LABEL.line },
  };
}

/**
 * Every gap's placement, in trace order, with no two labels sharing a box (Task 13 fix rounds B and 1). Labels are
 * right-aligned to the card and sit below their anchor, so gaps on one anchor, and gaps on sibling handles of one tier
 * row, would all land on the same line; a label whose back would intersect an earlier label's moves down, a label line
 * at a time, until it intersects none. A gap whose anchor is not measured has no placement (null).
 */
export function gapLabels(gaps: Array<{ anchor: AnchorRect | undefined; label: string }>, card: AnchorRect | undefined): Array<GapPlacement | null> {
  const placed: GapPlacement['back'][] = [];
  const hits = (a: GapPlacement['back'], b: GapPlacement['back']) =>
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 0;
  return gaps.map(({ anchor, label }) => {
    if (!anchor) return null;
    let stack = 0;
    let p = gapPlacement(anchor, card, label, stack);
    while (placed.some((b) => hits(p.back, b))) p = gapPlacement(anchor, card, label, ++stack);
    placed.push(p.back);
    return p;
  });
}

/** The traced card's own key: the edge parent or gap anchor that is no sub-tier node (the anchors hold the card under it). */
function cardKeyOf(trace: SmTrace): string | undefined {
  const aliases = new Set(trace.nodes.map((n) => n.alias));
  return [...trace.edges.map((e) => e.parent), ...trace.gaps.map((g) => g.at)].find((k) => !aliases.has(k));
}

/**
 * The shortfall trace (spec §12.3): one line per edge from the card to the binding node, each in its band's colour
 * with the band word in its description; a dashed stub with the status word at each gap. Mounted over the cards
 * (after them in the DOM), pointer-events none. An edge or gap whose anchor is not measured is skipped, never drawn
 * to (0, 0) and never thrown on (Review Focus 2).
 */
export function TraceOverlay({ trace, anchors, names, width, height }: {
  trace: SmTrace; anchors: Record<string, AnchorRect>; names: Record<string, string>; width: number; height: number;
}) {
  performance.clearMarks(TRACE_START);
  performance.mark(TRACE_START);
  useLayoutEffect(() => {
    performance.clearMeasures(TRACE_MEASURE);
    performance.measure(TRACE_MEASURE, TRACE_START);
  });
  const id = useId();
  const nameOf = (k: string) => names[k] ?? k;
  const cardKey = cardKeyOf(trace);
  const card = cardKey === undefined ? undefined : anchors[cardKey];
  const labels = gapLabels(trace.gaps.map((g) => ({ anchor: anchors[g.at], label: gapStubText(g.status) })), card);
  return (
    <svg data-trace role="img" aria-label={`Shortfall trace: ${traceSentence(trace, names)}`} width={width} height={height} className="pointer-events-none absolute inset-0">
      {trace.edges.map((e, i) => {
        const a = anchors[e.parent];
        const b = anchors[e.child];
        if (!a || !b) return null;
        const descId = `${id}-e${i}`;
        return (
          <path key={`e${i}`} data-trace-edge data-band={e.band} aria-describedby={descId} d={tracePath(a, b)} fill="none" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" style={{ stroke: bandVar(e.band) }}>
            <desc id={descId}>{`${bandWord(e.band)}: ${nameOf(e.parent)} to ${nameOf(e.child)}`}</desc>
          </path>
        );
      })}
      {trace.gaps.map((g, i) => {
        const p = labels[i];
        if (!p) return null;
        const label = gapStubText(g.status);
        return (
          <g key={`g${i}`} data-trace-gap data-status={g.status}>
            <path d={p.stub} fill="none" strokeWidth={2} strokeDasharray="4 4" style={{ stroke: 'var(--sm-line-control)' }} />
            <rect x={p.back.x} y={p.back.y} width={p.back.width} height={p.back.height} style={{ fill: 'var(--sm-card)' }} />
            <text x={p.text.x} y={p.text.y} textAnchor="end" textLength={p.text.width} fontSize={LABEL.font} style={{ fill: 'var(--sm-ink-2)' }}>{label}</text>
          </g>
        );
      })}
    </svg>
  );
}
