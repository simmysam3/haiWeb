import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  GapTierBar,
  ScorePill,
  tierBucket,
  tierLabel,
  tierPoints,
  scoreOf,
  worstTier,
  mergeTiers,
} from '../gap-tier';

describe('tierBucket', () => {
  it('returns 1 for depth 1', () => {
    expect(tierBucket(1)).toBe(1);
  });
  it('returns 4 for any depth >= 4', () => {
    expect(tierBucket(4)).toBe(4);
    expect(tierBucket(7)).toBe(4);
  });
  it('clamps depth < 1 to 1', () => {
    expect(tierBucket(0)).toBe(1);
    expect(tierBucket(-3)).toBe(1);
  });
});

describe('tierLabel', () => {
  it('returns "4+" for tier 4', () => {
    expect(tierLabel(4)).toBe('4+');
  });
  it('returns the number as string for tiers 1-3', () => {
    expect(tierLabel(1)).toBe('1');
    expect(tierLabel(3)).toBe('3');
  });
});

describe('tierPoints', () => {
  it('returns 5 / 3 / 2 / 1 for tiers 1-4', () => {
    expect(tierPoints(1)).toBe(5);
    expect(tierPoints(2)).toBe(3);
    expect(tierPoints(3)).toBe(2);
    expect(tierPoints(4)).toBe(1);
  });
  it('returns 1 for unknown tier (fallback)', () => {
    expect(tierPoints(99)).toBe(1);
  });
});

describe('scoreOf', () => {
  it('sums weighted gap counts', () => {
    const tiers = new Map<number, number>([
      [1, 2], // 2*5 = 10
      [2, 1], // 1*3 = 3
    ]);
    expect(scoreOf(tiers)).toBe(13);
  });
  it('returns 0 for empty map', () => {
    expect(scoreOf(new Map())).toBe(0);
  });
});

describe('worstTier', () => {
  it('returns the lowest tier present', () => {
    const tiers = new Map<number, number>([
      [2, 1],
      [4, 3],
    ]);
    expect(worstTier(tiers)).toBe(2);
  });
  it('returns null for empty map', () => {
    expect(worstTier(new Map())).toBe(null);
  });
});

describe('mergeTiers', () => {
  it('accumulates counts by tier', () => {
    const a = new Map<number, number>([
      [1, 1],
      [2, 2],
    ]);
    const b = new Map<number, number>([
      [2, 3],
      [3, 1],
    ]);
    mergeTiers(a, b);
    expect(a.get(1)).toBe(1);
    expect(a.get(2)).toBe(5);
    expect(a.get(3)).toBe(1);
  });
});

describe('<GapTierBar>', () => {
  it('renders em-dash when tier map is empty', () => {
    render(<GapTierBar tiers={new Map()} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
  it('renders one segment per tier up to the deepest gapped tier', () => {
    const tiers = new Map<number, number>([
      [1, 2],
      [3, 1],
    ]);
    render(<GapTierBar tiers={tiers} />);
    expect(screen.getByLabelText('Tier 1: 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Tier 2: 0')).toBeInTheDocument();
    expect(screen.getByLabelText('Tier 3: 1')).toBeInTheDocument();
  });
});

describe('<ScorePill>', () => {
  it('renders the literal "0" (plain text) when score is 0', () => {
    render(<ScorePill score={0} tiers={new Map()} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });
  it('renders score + "pts" when non-zero, shaded by worst tier', () => {
    const tiers = new Map<number, number>([[1, 2]]);
    render(<ScorePill score={10} tiers={tiers} />);
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('pts')).toBeInTheDocument();
  });
});
