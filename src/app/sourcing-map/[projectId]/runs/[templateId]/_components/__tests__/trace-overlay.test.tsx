import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CANDIDATE_NAMES, multitierDetail } from '@/app/sourcing-map/__fixtures__/sp2';
import type { SmTrace } from '@/lib/sourcing-map/types';
import { TraceOverlay, TRACE_MEASURE, tracePath, type AnchorRect } from '../trace-overlay';

const leon = multitierDetail.result!.slots[0]!.candidates[0]!;
/** The León card's header button, its A and C handles, as MapCanvas measures them (canvas frame). */
const ANCHORS: Record<string, AnchorRect> = {
  leon: { x: 348, y: 112, width: 212, height: 20 },
  A: { x: 372, y: 330, width: 90, height: 22 },
  C: { x: 372, y: 356, width: 90, height: 22 },
};
const DEEP: SmTrace = {
  nodes: [{ alias: 'A', tier: 2, role: 'inherited', band: 'moderate', binds_for: 1 }, { alias: 'C', tier: 3, role: 'binding', band: 'severe', binds_for: 2 }],
  edges: [{ parent: 'leon', child: 'A', band: 'moderate' }, { parent: 'A', child: 'C', band: 'severe' }],
  gaps: [],
};

describe('TraceOverlay', () => {
  it('draws one path per edge beside the cards, coloured by band, each described by its band word; the svg is an image named by the trace sentence (spec §12.3)', () => {
    performance.clearMeasures(TRACE_MEASURE);
    render(<TraceOverlay trace={leon.trace!} anchors={ANCHORS} names={CANDIDATE_NAMES} width={800} height={600} />);
    const svg = screen.getByRole('img', { name: 'Shortfall trace: León Cuero → A (moderate); binding: A (tier 2); not observed below León Cuero: not connected' });
    expect(svg.getAttribute('aria-hidden')).toBeNull();
    const edges = svg.querySelectorAll<SVGPathElement>('path[data-trace-edge]');
    expect(edges).toHaveLength(1);
    const e = edges[0]!;
    expect(tracePath(ANCHORS.leon!, ANCHORS.A!)).toBe('M348 122 L 338 122 L 338 341 L 372 341');
    expect(e.getAttribute('d')).toBe('M348 122 L 338 122 L 338 341 L 372 341');
    expect(e.getAttribute('data-band')).toBe('moderate');
    expect(e.style.stroke).toBe('var(--sm-heat-mid)');
    const desc = e.querySelector('desc')!;
    expect(desc.id).toBe(e.getAttribute('aria-describedby'));
    expect(desc.textContent).toBe('moderate: León Cuero to A');
    // R-9-style measure: one entry per render, read by the Playwright harness in a real browser
    const measures = performance.getEntriesByName(TRACE_MEASURE, 'measure');
    expect(measures).toHaveLength(1);
    expect(Number.isFinite(measures[0]!.duration)).toBe(true);
  });

  it('draws a dashed stub with the status word at each gap (contract §10 copy)', () => {
    render(<TraceOverlay trace={leon.trace!} anchors={ANCHORS} names={CANDIDATE_NAMES} width={800} height={600} />);
    const gap = document.querySelector<SVGGElement>('g[data-trace-gap][data-status="not_connected"]')!;
    expect(gap.querySelector('path')!.getAttribute('d')).toBe('M560 122 L 574 122');
    expect(gap.querySelector('path')!.getAttribute('stroke-dasharray')).toBe('4 4');
    expect(gap.querySelector('path')!.style.stroke).toBe('var(--sm-line-control)');
    expect(gap.querySelector('text')!.textContent).toBe('not observed below: not connected');
  });

  it('follows a two-edge trace handle to handle, each edge in its own band colour', () => {
    render(<TraceOverlay trace={DEEP} anchors={ANCHORS} names={CANDIDATE_NAMES} width={800} height={600} />);
    const edges = Array.from(document.querySelectorAll<SVGPathElement>('path[data-trace-edge]'));
    expect(edges.map((p) => p.getAttribute('d'))).toEqual(['M348 122 L 338 122 L 338 341 L 372 341', 'M372 341 L 362 341 L 362 367 L 372 367']);
    expect(edges.map((p) => p.style.stroke)).toEqual(['var(--sm-heat-mid)', 'var(--sm-heat-bad)']);
    expect(screen.getByRole('img', { name: 'Shortfall trace: León Cuero → A (moderate); A → C (severe); binding: C (tier 3), for 2 options' })).toBeInTheDocument();
  });

  it('skips an edge or gap whose anchor is not measured yet, draws the rest, and never throws or draws to (0, 0) (Review Focus 2)', () => {
    const { rerender } = render(<TraceOverlay trace={DEEP} anchors={{ leon: ANCHORS.leon!, A: ANCHORS.A! }} names={CANDIDATE_NAMES} width={800} height={600} />);
    let edges = Array.from(document.querySelectorAll<SVGPathElement>('path[data-trace-edge]'));
    expect(edges.map((p) => p.getAttribute('d'))).toEqual(['M348 122 L 338 122 L 338 341 L 372 341']);
    expect(() => rerender(<TraceOverlay trace={leon.trace!} anchors={{}} names={CANDIDATE_NAMES} width={800} height={600} />)).not.toThrow();
    edges = Array.from(document.querySelectorAll<SVGPathElement>('path[data-trace-edge]'));
    expect(edges).toHaveLength(0);
    expect(document.querySelectorAll('g[data-trace-gap]')).toHaveLength(0);
    expect(document.body.innerHTML).not.toMatch(/M0 0|L 0 0/);
    // the sentence still names the whole trace: what could not be drawn is still told
    expect(screen.getByRole('img', { name: /^Shortfall trace: León Cuero/ })).toBeInTheDocument();
  });
});
