import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CANDIDATE_NAMES, multitierDetail } from '@/app/sourcing-map/__fixtures__/sp2';
import type { SmTrace } from '@/lib/sourcing-map/types';
import { gapPlacement, TraceOverlay, TRACE_MEASURE, tracePath, type AnchorRect } from '../trace-overlay';

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

  it('draws a dashed stub with the status word at a handle gap (contract §10 copy)', () => {
    render(<TraceOverlay trace={{ ...DEEP, gaps: [{ at: 'C', status: 'not_connected' }] }} anchors={ANCHORS} names={CANDIDATE_NAMES} width={800} height={600} />);
    const gap = document.querySelector<SVGGElement>('g[data-trace-gap][data-status="not_connected"]')!;
    expect(gap.querySelector('path')!.getAttribute('d')).toBe('M462 367 L 476 367');
    expect(gap.querySelector('path')!.getAttribute('stroke-dasharray')).toBe('4 4');
    expect(gap.querySelector('path')!.style.stroke).toBe('var(--sm-line-control)');
    expect(gap.querySelector('text')!.textContent).toBe('not observed below: not connected');
    // Task 13 R3: the label is on the line below the anchor, right-aligned to the card, over a card-coloured back
    const text = gap.querySelector('text')!;
    expect(text.getAttribute('text-anchor')).toBe('end');
    expect([text.getAttribute('x'), text.getAttribute('y'), text.getAttribute('textLength')]).toEqual(['560', '394', '185']);
    const back = gap.querySelector('rect')!;
    expect([back.getAttribute('x'), back.getAttribute('y'), back.getAttribute('width'), back.getAttribute('height')]).toEqual(['373', '382', '187', '16']);
    expect(back.style.fill).toBe('var(--sm-card)');
    expect(back.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('draws a card-level gap as its dashed stub only: no back, no label, no label line held; a handle gap keeps its label; the svg still names both (F-2: the card anchor is its header, so the label landed on the class-path subtitle)', () => {
    // A on the header's row, so its label would land on the line the card's own label held (back y 136)
    const anchors = { ...ANCHORS, A: { x: 372, y: 112, width: 90, height: 20 } };
    const trace: SmTrace = { ...DEEP, gaps: [{ at: 'leon', status: 'not_connected' }, { at: 'A', status: 'declined' }] };
    render(<TraceOverlay trace={trace} anchors={anchors} names={CANDIDATE_NAMES} width={800} height={600} />);
    const own = document.querySelector<SVGGElement>('g[data-trace-gap][data-status="not_connected"]')!;
    expect(own.querySelector('path')!.getAttribute('d')).toBe('M560 122 L 574 122');
    expect(own.querySelector('path')!.getAttribute('stroke-dasharray')).toBe('4 4');
    expect(own.querySelector('rect')).toBeNull();
    expect(own.querySelector('text')).toBeNull();
    const handle = document.querySelector<SVGGElement>('g[data-trace-gap][data-status="declined"]')!;
    expect(handle.querySelector('text')!.textContent).toBe('not observed below: declined');
    // unstacked: the card-level gap holds no label box for it to move below
    expect([handle.querySelector('text')!.getAttribute('y'), handle.querySelector('rect')!.getAttribute('y')]).toEqual(['148', '136']);
    expect(screen.getByRole('img', { name: /not observed below León Cuero: not connected; not observed below A: declined$/ })).toBeInTheDocument();
  });

  it('places a gap label inside the traced card: one line below its anchor, right-aligned to the card, so it never paints into the next card or past the svg (Task 13 R3, measured in chromium)', () => {
    const label = 'not observed below: not connected';
    // the card's own gap: the stub leaves the header's right-mid into the card gap (the overlay draws only the stub, F-2)
    const own = gapPlacement(ANCHORS.leon!, ANCHORS.leon!, label);
    expect(own.stub).toBe('M560 122 L 574 122');
    // 33 characters at 11 px (chromium measured 185.5 px); fixed through textLength, so the back needs no measuring
    expect(own.text).toEqual({ x: 560, y: 112 + 20 + 4 + 12, width: 185 });
    expect(own.back).toEqual({ x: 560 - 185 - 2, y: 112 + 20 + 4, width: 187, height: 16 });
    expect(own.back.x).toBeGreaterThanOrEqual(ANCHORS.leon!.x);
    // a handle's gap: right-aligned to the card as well, never to the handle, so a wide label cannot spill left into a neighbour
    const deep = gapPlacement(ANCHORS.C!, ANCHORS.leon!, label);
    expect(deep.stub).toBe('M462 367 L 476 367');
    expect(deep.text).toEqual({ x: 560, y: 356 + 22 + 4 + 12, width: 185 });
    expect(deep.back.x).toBeGreaterThanOrEqual(ANCHORS.leon!.x);
    // no card measured: the anchor's own right edge
    expect(gapPlacement(ANCHORS.C!, undefined, label).text.x).toBe(462);
    // the overlay finds the card from the trace (the edge parent that is no sub-tier node) for a handle's gap
    render(<TraceOverlay trace={{ ...DEEP, gaps: [{ at: 'C', status: 'declined' }] }} anchors={ANCHORS} names={CANDIDATE_NAMES} width={800} height={600} />);
    const text = document.querySelector('g[data-trace-gap][data-status="declined"] text')!;
    expect(text.textContent).toBe('not observed below: declined');
    expect([text.getAttribute('x'), text.getAttribute('y')]).toEqual(['560', '394']);
  });

  it('stacks several gap labels on one anchor one line apart, so none overlaps or hides another; another anchor starts its own stack (Task 13 fix round B)', () => {
    const trace: SmTrace = { ...DEEP, gaps: [{ at: 'C', status: 'not_connected' }, { at: 'C', status: 'declined' }, { at: 'A', status: 'timeout' }] };
    render(<TraceOverlay trace={trace} anchors={ANCHORS} names={CANDIDATE_NAMES} width={800} height={600} />);
    const gaps = Array.from(document.querySelectorAll<SVGGElement>('g[data-trace-gap]')).map((g) => ({
      status: g.getAttribute('data-status'),
      stub: g.querySelector('path')!.getAttribute('d'),
      textY: Number(g.querySelector('text')!.getAttribute('y')),
      backY: Number(g.querySelector('rect')!.getAttribute('y')),
      backH: Number(g.querySelector('rect')!.getAttribute('height')),
    }));
    expect(gaps.map(({ status, stub, textY, backY }) => ({ status, stub, textY, backY }))).toEqual([
      { status: 'not_connected', stub: 'M462 367 L 476 367', textY: 394, backY: 382 },
      { status: 'declined', stub: 'M462 367 L 476 367', textY: 410, backY: 398 },
      { status: 'timeout', stub: 'M462 341 L 476 341', textY: 368, backY: 356 },
    ]);
    // the backs on one anchor abut and never overlap, so the second label hides nothing of the first
    expect(gaps[0]!.backY + gaps[0]!.backH).toBeLessThanOrEqual(gaps[1]!.backY);
    expect(gapPlacement(ANCHORS.C!, ANCHORS.leon!, 'not observed below: declined', 1).text.y).toBe(394 + 16);
    expect(gapPlacement(ANCHORS.C!, ANCHORS.leon!, 'not observed below: declined', 1).back.y).toBe(382 + 16);
  });

  it('stacks gap labels by the row they land on, not by their anchor: sibling handles in one tier row never share a label box (Task 13 fix round 1)', () => {
    // A and B side by side in León's tier-2 row (same y and height), C in the tier-3 row below
    const row: Record<string, AnchorRect> = { ...ANCHORS, A: { x: 372, y: 330, width: 90, height: 22 }, B: { x: 468, y: 330, width: 90, height: 22 } };
    const trace: SmTrace = { ...leon.trace!, gaps: [{ at: 'A', status: 'not_connected' }, { at: 'B', status: 'declined' }, { at: 'C', status: 'timeout' }] };
    render(<TraceOverlay trace={trace} anchors={row} names={CANDIDATE_NAMES} width={800} height={600} />);
    const boxes = Array.from(document.querySelectorAll<SVGGElement>('g[data-trace-gap]')).map((g) => {
      const back = g.querySelector('rect')!;
      return {
        status: g.getAttribute('data-status'),
        textY: Number(g.querySelector('text')!.getAttribute('y')),
        x: Number(back.getAttribute('x')), y: Number(back.getAttribute('y')), w: Number(back.getAttribute('width')), h: Number(back.getAttribute('height')),
      };
    });
    // A's label on the line below the row; B's, which would land on the same line, one line lower; C's would begin
    // inside B's back (tier 3 is 26 px below tier 2: 382 < 388), so it moves down a label line, clear of B's
    expect(boxes.map(({ status, textY, y }) => ({ status, textY, y }))).toEqual([
      { status: 'not_connected', textY: 368, y: 356 },
      { status: 'declined', textY: 384, y: 372 },
      { status: 'timeout', textY: 410, y: 398 },
    ]);
    // no two labels share any part of a box
    const overlaps = (a: typeof boxes[number], b: typeof boxes[number]) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlaps(boxes[i]!, boxes[j]!)).toBe(false);
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
