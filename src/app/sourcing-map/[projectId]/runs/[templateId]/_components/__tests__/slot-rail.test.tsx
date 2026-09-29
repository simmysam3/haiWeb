import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { vomeroResult, VOMERO_IDS } from '@/lib/sourcing-map/__fixtures__/vomero';
import { layoutMap, RAIL_L } from '@/lib/sourcing-map/map/layout';
import { SlotRail } from '../slot-rail';

const NAMES = { [VOMERO_IDS.pegasus]: 'Pegasus Trail', [VOMERO_IDS.court]: 'Court Classic', [VOMERO_IDS.metcon]: 'Metcon Iron' };

function mount(slotIndex: number) {
  const lane = layoutMap(vomeroResult.slots, new Set()).lanes[slotIndex]!;
  const { container } = render(
    <SlotRail slot={vomeroResult.slots[slotIndex]!} asOfDrop="2027-03-15" collapsed={false} onToggle={vi.fn()}
      productNames={NAMES} productFilter={null} textH={lane.textH} />,
  );
  return { rail: container.firstElementChild as HTMLElement, lane };
}

/** The height a line takes in the rail: its own, and the gap above it. */
function taken(el: HTMLElement): number {
  return (parseFloat(el.style.height) || 0) + (parseFloat(el.style.marginTop) || 0);
}

describe('SlotRail', () => {
  it('renders each line at the height the layout reserves, on one line, inside a box as tall as the reserved text (walk B1, 2026-09-29)', () => {
    const { rail, lane } = mount(4);
    expect(rail.style.height).toBe(`${lane.textH}px`);
    expect(rail.style.overflow).toBe('hidden');
    const lines = Array.from(rail.children) as HTMLElement[];
    // Flat laces: title, requirement, products, coverage.
    expect(lines).toHaveLength(4);
    expect(lines.reduce((sum, el) => sum + taken(el), 0)).toBe(lane.textH);
    for (const el of lines) {
      expect(el.style.lineHeight).toBe(el.style.height);
      // One line each: a long product list is cut with an ellipsis and stays readable in the title.
      const text = el.tagName === 'BUTTON' ? within(el).getByText('Flat laces') : el;
      expect(text.className).toContain('truncate');
      expect(text.getAttribute('title')).toBe(text.textContent);
    }
    expect(screen.getByRole('button', { name: 'Flat laces' }).style.height).toBe(`${RAIL_L.line}px`);
  });

  it('draws the size strip in cells of the reserved size, so it wraps into the rows the layout counted', () => {
    const { rail, lane } = mount(2);
    const strip = within(rail).getByRole('list', { name: 'Coverage by size' });
    expect(strip.style.marginTop).toBe(`${RAIL_L.lineGap}px`);
    expect(strip.style.gap).toBe(`${RAIL_L.cellGap}px`);
    const cells = within(strip).getAllByRole('img');
    expect(cells).toHaveLength(13);
    for (const cell of cells) {
      expect(cell.style.width).toBe(`${RAIL_L.cellW}px`);
      expect(cell.style.height).toBe(`${RAIL_L.cellH}px`);
      expect(cell.className).toContain('truncate');
    }
    // Rubber outsoles: the four lines and the size-bound label, then two rows of cells (11 fit a 740 px lane).
    const lines = (Array.from(rail.children) as HTMLElement[]).filter((el) => el !== strip);
    expect(lines.reduce((sum, el) => sum + taken(el), 0)).toBe(84 + RAIL_L.small);
    expect(lane.textH - (84 + RAIL_L.small)).toBe(RAIL_L.lineGap + 2 * RAIL_L.cellH + RAIL_L.cellGap);
  });
});
