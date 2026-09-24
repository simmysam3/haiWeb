import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { vomeroResult, VOMERO_IDS } from '@/lib/sourcing-map/__fixtures__/vomero';
import type { SourcingMapExecutionResult } from '@/lib/sourcing-map/contract';
import { MapCanvas } from '../map-canvas';

const SEAT = { name: 'CSG Footwear Vietnam', country: 'VN', classLabel: 'Athletic footwear', productCount: 3, slotCount: 5, assemblyDays: '21', capacity: 18000 };
const NAMES = { [VOMERO_IDS.pegasus]: 'Pegasus Trail', [VOMERO_IDS.court]: 'Court Classic', [VOMERO_IDS.metcon]: 'Metcon Iron' };

function mount(result: SourcingMapExecutionResult, extra: Partial<Parameters<typeof MapCanvas>[0]> = {}) {
  return render(
    <MapCanvas result={result} asOfDrop="2027-03-15" productFilter={null} productNames={NAMES} seat={SEAT} selected={null}
      onSelect={vi.fn()} collapsed={new Set()} onToggle={vi.fn()} {...extra} />,
  );
}

describe('MapCanvas', () => {
  it('draws the seat, a rail per slot with its requirement and coverage, the cards, the heat links and the legend, and records its render (R-9)', () => {
    const withCap = structuredCloneSafe(vomeroResult);
    withCap.slots[4]!.not_probed_count = 2;
    performance.clearMeasures('sm-map-render');
    mount(withCap);
    expect(screen.getByRole('region', { name: 'Sourcing map' })).toBeInTheDocument();
    expect(screen.getByText('CSG Footwear Vietnam')).toBeInTheDocument();
    expect(screen.getByText('VN · Athletic footwear')).toBeInTheDocument();
    const leather = screen.getByRole('group', { name: 'Full grain leather hides' });
    // Lane pre-empt: the rail's collapse toggle is a button that exposes its state.
    expect(within(leather).getByRole('button', { name: 'Full grain leather hides' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(leather).getByText('12,000 sq ft by Feb 22')).toBeInTheDocument();
    expect(within(leather).getByText('Covered 81% by this drop · not fully observed')).toBeInTheDocument();
    expect(within(leather).getByText('Size-bound')).toBeInTheDocument();
    expect(within(leather).getAllByRole('button', { name: /,/ })).toHaveLength(3);
    const eyelets = screen.getByRole('group', { name: 'Metal eyelets' });
    expect(within(eyelets).getByText('No trading partner publishes this class')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Flat laces' })).getByText('+2 not probed')).toBeInTheDocument();
    expect(screen.getByText('Direct suppliers only; nothing below tier 1 has been traced.')).toBeInTheDocument();
    const svg = document.querySelector('svg[data-map-links]')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    // D9, AC 18: links carry the 90 / 70 heat. Paths are drawn lane by lane, the lane link first: leather's lane
    // covers 81% (mid), then its cards' links, León 41% (bad), Mekong 100% (good) and Arno, who timed out (neutral).
    const strokes = Array.from(svg.querySelectorAll('path')).slice(0, 4).map((p) => p.style.stroke);
    expect(strokes).toEqual(['var(--sm-heat-mid)', 'var(--sm-heat-bad)', 'var(--sm-heat-good)', 'var(--sm-line-2)']);
    // R-9 (S8, ruling 10): each render records the measure that the SP1-e walk reads in a real browser (Task 41).
    const measures = performance.getEntriesByName('sm-map-render', 'measure');
    expect(measures).toHaveLength(1);
    expect(Number.isFinite(measures[0]!.duration)).toBe(true);
  });
});

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
