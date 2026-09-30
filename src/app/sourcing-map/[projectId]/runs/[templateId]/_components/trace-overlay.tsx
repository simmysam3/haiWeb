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

/** From the parent's left-mid, out into the gutter, down to the child's mid-line, into the child's left edge. */
export function tracePath(a: AnchorRect, b: AnchorRect): string {
  const sx = a.x;
  const sy = a.y + a.height / 2;
  const ex = b.x;
  const ey = b.y + b.height / 2;
  const gx = Math.min(sx, ex) - GUTTER;
  return `M${sx} ${sy} L ${gx} ${sy} L ${gx} ${ey} L ${ex} ${ey}`;
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
        const a = anchors[g.at];
        if (!a) return null;
        const x = a.x + a.width;
        const y = a.y + a.height / 2;
        return (
          <g key={`g${i}`} data-trace-gap data-status={g.status}>
            <path d={`M${x} ${y} L ${x + STUB} ${y}`} fill="none" strokeWidth={2} strokeDasharray="4 4" style={{ stroke: 'var(--sm-line-control)' }} />
            <text x={x + STUB + 4} y={y + 4} fontSize={11} style={{ fill: 'var(--sm-ink-2)' }}>{gapStubText(g.status)}</text>
          </g>
        );
      })}
    </svg>
  );
}
